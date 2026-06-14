"""
DartScorer — ports the core logic from dart-sense (get_scores.py + video_processing.py).
No cv2/X11 dependency: uses PIL for image I/O and numpy SVD for homography.
"""
import io
import base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import Optional


# ── Homography via Direct Linear Transform ────────────────────────────────────

def _find_homography_dlt(src_pts: np.ndarray, dst_pts: np.ndarray) -> Optional[np.ndarray]:
    """
    Compute 3×3 homography H such that dst ~ H @ src (normalised homogeneous).
    Uses DLT + numpy SVD.  Returns None if fewer than 4 valid correspondences.
    """
    n = src_pts.shape[0]
    if n < 4:
        return None

    # Normalize for numerical stability
    def _norm(pts):
        c = pts.mean(axis=0)
        d = np.sqrt(((pts - c) ** 2).sum(axis=1)).mean()
        if d < 1e-10:
            d = 1.0
        s = np.sqrt(2) / d
        T = np.array([[s, 0, -s * c[0]],
                      [0, s, -s * c[1]],
                      [0, 0,          1]], dtype=float)
        ph = np.column_stack([pts, np.ones(n)])
        return (T @ ph.T).T[:, :2], T

    src_n, T_src = _norm(src_pts)
    dst_n, T_dst = _norm(dst_pts)

    A = []
    for (x, y), (xp, yp) in zip(src_n, dst_n):
        A.append([-x, -y, -1, 0, 0, 0, xp * x, xp * y, xp])
        A.append([0, 0, 0, -x, -y, -1, yp * x, yp * y, yp])
    A = np.array(A)
    _, _, Vh = np.linalg.svd(A)
    H_n = Vh[-1].reshape(3, 3)
    H = np.linalg.inv(T_dst) @ H_n @ T_src
    H /= H[2, 2]
    return H


class DartScorer:
    def __init__(self, model_path: str = "weights.pt"):
        from ultralytics import YOLO
        self.model = YOLO(model_path)

        # Board geometry (mm), normalised by 451 mm diameter — from dart-sense
        ring          = 10.0
        bullseye_wire = 1.6
        self.scoring_names  = np.array(["DB", "SB", "S", "T", "S", "D", "miss"])
        self.scoring_radii  = np.array(
            [0, 6.35, 15.9, 107.4 - ring, 107.4, 170.0 - ring, 170.0]
        )
        self.scoring_radii[1:3] += bullseye_wire / 2
        self.scoring_radii /= 451.0

        self.segment_angles  = np.array([-9, 9, 27, 45, 63, -81, -63, -45, -27])
        self.segment_numbers = np.array(
            [[6, 11], [10, 14], [15, 9], [2, 12], [17, 5],
             [19, 1], [7, 18], [16, 4], [8, 13]]
        )

        # Pre-compute board-plane calibration coordinates
        # (outer double corners of segments 20, 6, 3, 11)
        self.boardplane_calibration_coords = -np.ones((6, 2))
        h = self.scoring_radii[-1]

        a = h * np.cos(np.deg2rad(81)); o = (h ** 2 - a ** 2) ** 0.5
        self.boardplane_calibration_coords[0] = [0.5 - a, 0.5 - o]
        self.boardplane_calibration_coords[1] = [0.5 + a, 0.5 + o]

        a = h * np.cos(np.deg2rad(-9)); o = (h ** 2 - a ** 2) ** 0.5
        self.boardplane_calibration_coords[2] = [0.5 - a, 0.5 + o]
        self.boardplane_calibration_coords[3] = [0.5 + a, 0.5 - o]

        a = h * np.cos(np.deg2rad(27)); o = (h ** 2 - a ** 2) ** 0.5
        self.boardplane_calibration_coords[4] = [0.5 - a, 0.5 - o]
        self.boardplane_calibration_coords[5] = [0.5 + a, 0.5 + o]

    # ── YOLO output parsing ───────────────────────────────────────────────────

    def _process_yolo_output(self, output):
        calibration_coords = -np.ones((6, 2))
        dart_coords        = []

        classes = output.boxes.cls.cpu().numpy()
        boxes   = output.boxes.xywhn.cpu().numpy()   # [cx, cy, w, h] normalised
        conf    = output.boxes.conf.cpu().numpy()

        for i in range(len(classes)):
            cls = int(classes[i])
            if cls == 4:                              # dart
                if len(dart_coords) < 3:
                    dart_coords.append([boxes[i][0], boxes[i][1]])
            else:                                     # calibration corner (0-3)
                if conf[i] < 0.85:
                    continue
                cal_i = cls if cls < 4 else cls - 1
                if np.all(calibration_coords[cal_i] == -1):
                    calibration_coords[cal_i] = boxes[i][:2]

        return calibration_coords, np.array(dart_coords)

    # ── Homography ────────────────────────────────────────────────────────────

    def _find_homography(self, calibration_coords, image_shape: float):
        mask    = np.all(
            np.logical_and(calibration_coords >= 0, calibration_coords <= 1), axis=1
        )
        n_valid = int(np.sum(mask))
        if n_valid < 4:
            return None, n_valid
        src = calibration_coords[mask] * image_shape
        dst = self.boardplane_calibration_coords[mask] * image_shape
        H   = _find_homography_dlt(src, dst)
        return H, n_valid

    def _transform_to_boardplane(self, H, dart_coords, image_shape: float):
        if len(dart_coords) == 0:
            return dart_coords
        pts  = dart_coords * image_shape
        hom  = np.column_stack([pts, np.ones(pts.shape[0])]).T
        xf   = H @ hom
        xf  /= xf[-1]
        xf   = xf[:-1].T / image_shape
        return xf

    # ── Scoring ───────────────────────────────────────────────────────────────

    def _score(self, transformed_darts) -> tuple[list[str], int]:
        if len(transformed_darts) == 0:
            return [], 0

        darts_out: list[str] = []
        total = 0
        td    = transformed_darts.copy()

        mask = td[:, 0] == 0.5
        td[mask, 0] += 0.00001

        angles = np.rad2deg(np.arctan((td[:, 1] - 0.5) / (td[:, 0] - 0.5)))
        angles = np.where(angles > 0, np.floor(angles), np.ceil(angles))

        for i in range(len(td)):
            dart_xy = td[i]
            ang     = angles[i]

            if abs(ang) >= 81:
                possible = np.array([3, 20])
            else:
                possible = self.segment_numbers[
                    np.where(
                        self.segment_angles == max(self.segment_angles[self.segment_angles <= ang])
                    )
                ][0]

            coord_idx = 0 if all(possible == [6, 11]) else 1
            number    = possible[0] if dart_xy[coord_idx] > 0.5 else possible[1]

            dist   = ((dart_xy[0] - 0.5) ** 2 + (dart_xy[1] - 0.5) ** 2) ** 0.5
            region = self.scoring_names[
                np.argmax(self.scoring_radii[dist > self.scoring_radii])
            ]

            label_map = {
                "DB":   ("DB",          50),
                "SB":   ("SB",          25),
                "S":    (f"S{number}",  number),
                "T":    (f"T{number}",  number * 3),
                "D":    (f"D{number}",  number * 2),
                "miss": ("miss",        0),
            }
            label, val = label_map[region]
            darts_out.append(label)
            total += val

        return darts_out, total

    # ── Main entry point ──────────────────────────────────────────────────────

    def analyze_image(self, img_bytes: bytes) -> dict:
        # Load image with PIL — no X11 dependency
        try:
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        except Exception as e:
            return {"error": f"Could not decode image: {e}", "darts": [], "total": 0, "calibrationPoints": 0}

        w, h         = pil_img.size
        resolution   = np.array([w, h], dtype=float)
        crop_size    = float(min(h, w))
        crop_start   = resolution / 2.0 - crop_size / 2.0

        # Run YOLO (accepts PIL image directly)
        results = self.model(pil_img, verbose=False)
        result  = results[0]

        calibration_coords, dart_coords = self._process_yolo_output(result)

        # Adjust coords from full-image to square-crop space
        cal_adj      = calibration_coords.copy()
        valid_mask   = np.all(cal_adj >= 0, axis=1)
        cal_adj[valid_mask] = (cal_adj[valid_mask] * resolution - crop_start) / crop_size

        n_valid_cal = int(np.sum(
            np.all(np.logical_and(cal_adj >= 0, cal_adj <= 1), axis=1)
        ))

        if n_valid_cal < 4:
            annotated_b64 = self._encode_annotated(pil_img, dart_coords=np.array([]), labels=[])
            return {
                "error": f"Only {n_valid_cal}/4 calibration points found. "
                         "Make sure the full board is visible with good lighting.",
                "darts": [],
                "total": 0,
                "calibrationPoints": n_valid_cal,
                "annotatedImage": annotated_b64,
            }

        if dart_coords.shape != (0,):
            dc_adj = (dart_coords * resolution - crop_start) / crop_size
            dc_adj = dc_adj[np.all(np.logical_and(dc_adj >= 0, dc_adj <= 1), axis=1)]
        else:
            dc_adj = dart_coords

        H, _ = self._find_homography(cal_adj, crop_size)
        if H is None:
            return {"error": "Homography failed — board not calibrated.",
                    "darts": [], "total": 0, "calibrationPoints": n_valid_cal}

        transformed = self._transform_to_boardplane(H, dc_adj, crop_size)
        td          = np.array(transformed) if len(transformed) > 0 else np.empty((0, 2))
        labels, total = self._score(td)

        annotated_b64 = self._encode_annotated(pil_img, dart_coords=dart_coords, labels=labels)

        dart_details = [
            {"label": lbl, "value": self._label_to_value(lbl)} for lbl in labels
        ]

        return {
            "darts":           dart_details,
            "total":           total,
            "annotatedImage":  annotated_b64,
            "calibrationPoints": n_valid_cal,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _label_to_value(label: str) -> int:
        if label == "DB":               return 50
        if label in ("SB", "Bull"):     return 25
        if label == "miss":             return 0
        if label.startswith("T"):       return int(label[1:]) * 3
        if label.startswith("D"):       return int(label[1:]) * 2
        if label.startswith("S"):       return int(label[1:])
        try:    return int(label)
        except: return 0

    def _encode_annotated(self, pil_img: Image.Image,
                          dart_coords: np.ndarray, labels: list[str]) -> str:
        annotated = pil_img.copy()
        draw      = ImageDraw.Draw(annotated)
        w, h      = annotated.size
        colors    = ["#00ffff", "#ffff00", "#ff00ff"]

        if dart_coords.shape[0] > 0:
            for i, coord in enumerate(dart_coords):
                x     = int(coord[0] * w)
                y     = int(coord[1] * h)
                col   = colors[i % len(colors)]
                r     = max(8, min(w, h) // 50)
                draw.ellipse([x - r, y - r, x + r, y + r], outline=col, width=3)
                label = labels[i] if i < len(labels) else "?"
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size=max(14, r * 2))
                except Exception:
                    font = ImageFont.load_default()
                draw.text((x + r + 4, y - r), label, fill=col, font=font)

        buf = io.BytesIO()
        annotated.save(buf, format="JPEG", quality=80)
        return base64.b64encode(buf.getvalue()).decode("utf-8")
