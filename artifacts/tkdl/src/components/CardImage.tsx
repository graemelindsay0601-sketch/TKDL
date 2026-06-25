import { useState } from "react";

interface CardImageProps {
  card: {
    name?: string;
    cardId?: string;
    gameMode?: string;
    cardType?: string;
    rarity?: string;
    effect?: string;
    gridIndex?: number;
  };
  size?: "small" | "medium" | "large";
  showBack?: boolean;
}

export function CardImage({ card, size = "medium", showBack = false }: CardImageProps) {
  const [isFlipped, setIsFlipped] = useState(showBack);

  const sizeMap = {
    small: 80,
    medium: 120,
    large: 180,
  };

  if (!card || !card.gameMode) {
    return (
      <div
        style={{
          width: `${sizeMap[size]}px`,
          height: `${(sizeMap[size] * 3) / 2}px`,
          background: "rgba(0,0,0,0.3)",
          border: "2px dashed rgba(255,255,255,0.2)",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.5)",
          fontSize: "12px",
        }}
      >
        Card Not Available
      </div>
    );
  }

  const width = sizeMap[size];
  const height = (width * 3) / 2;

  const gameMode = (card.gameMode || "X01").toUpperCase();
  const cardType = (card.cardType || "GOOD").toUpperCase();

  // Get front card image
  const getFrontImage = (): string => {
    if (gameMode === "X01") {
      return cardType === "GOOD" ? "/cards/x01-good-grid.png" : "/cards/x01-bad-grid.png";
    } else if (gameMode === "CRICKET") {
      return cardType === "GOOD" ? "/cards/cricket-good-grid.png" : "/cards/cricket-bad-grid.png";
    } else if (gameMode === "WILDCARD") {
      return cardType === "GOOD" ? "/cards/wildcard-good-grid.png" : "/cards/wildcard-bad-grid.png";
    }
    return "/cards/card-back.png";
  };

  // Calculate position in front card grid (5 cols x 4 rows)
  const gridIndex = card.gridIndex ?? 0;
  const colIndex = gridIndex % 5;
  const rowIndex = Math.floor(gridIndex / 5);

  // Position as percentages
  const bgPosX = colIndex * 20; // 5 columns = 20% each
  const bgPosY = rowIndex * 25; // 4 rows = 25% each
  const bgSizeX = 500; // 5 columns = 500%
  const bgSizeY = 400; // 4 rows = 400%

  // Get back card image and position
  const getBackImagePosition = (): { image: string; x: number; y: number } => {
    // Card backs are 3x2 grid (3 columns, 2 rows)
    // X01 GOOD = 0,0; X01 BAD = 1,0; CRICKET GOOD = 2,0
    // CRICKET BAD = 0,1; WILDCARD GOOD = 1,1; WILDCARD BAD = 2,1

    let backCol = 0,
      backRow = 0;

    if (gameMode === "X01") {
      backCol = cardType === "GOOD" ? 0 : 1;
      backRow = 0;
    } else if (gameMode === "CRICKET") {
      backCol = cardType === "GOOD" ? 2 : 0;
      backRow = cardType === "GOOD" ? 0 : 1;
    } else if (gameMode === "WILDCARD") {
      backCol = 1;
      backRow = cardType === "GOOD" ? 1 : 1;
      if (cardType === "BAD") backCol = 2;
    }

    return {
      image: "/cards/card-backs.png",
      x: backCol * 33.33, // 3 columns = 33.33% each
      y: backRow * 50, // 2 rows = 50% each
    };
  };

  const backImagePos = getBackImagePosition();

  const flipStyle: React.CSSProperties = {
    perspective: "1000px",
    width: `${width}px`,
    height: `${height}px`,
    cursor: "pointer",
    position: "relative",
  };

  const flipInnerStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    transition: "transform 0.6s",
    transformStyle: "preserve-3d",
    transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
  };

  const cardSideStyle: React.CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    backfaceVisibility: "hidden",
    borderRadius: "8px",
    overflow: "hidden",
  };

  const frontStyle: React.CSSProperties = {
    ...cardSideStyle,
    backgroundImage: `url('${getFrontImage()}')`,
    backgroundPosition: `${bgPosX}% ${bgPosY}%`,
    backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
    backgroundRepeat: "no-repeat",
  };

  const backStyle: React.CSSProperties = {
    ...cardSideStyle,
    transform: "rotateY(180deg)",
    backgroundImage: `url('${backImagePos.image}')`,
    backgroundPosition: `${backImagePos.x}% ${backImagePos.y}%`,
    backgroundSize: "300% 200%",
    backgroundRepeat: "no-repeat",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div style={flipStyle} onClick={() => setIsFlipped(!isFlipped)}>
      <div style={flipInnerStyle}>
        <div style={frontStyle} />
        <div style={backStyle}>
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "8px",
              right: "8px",
              color: "rgba(255,255,255,0.8)",
              fontSize: "10px",
              textAlign: "left",
              background: "rgba(0,0,0,0.5)",
              padding: "6px",
              borderRadius: "4px",
              maxHeight: "60%",
              overflow: "hidden",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>EFFECT:</div>
            <div style={{ fontSize: "9px", lineHeight: "1.2" }}>{card.effect || "No effect"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export card image with 3D rotation spinner for activation
export function CardImageWithSpinner({
  card,
  size = "medium",
  isActivating = false,
}: CardImageProps & { isActivating?: boolean }) {
  const sizeMap = {
    small: 80,
    medium: 120,
    large: 180,
  };

  const width = sizeMap[size];

  return (
    <div
      style={{
        position: "relative",
        width: `${width}px`,
        height: `${(width * 3) / 2}px`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          animation: isActivating ? "spin3d 0.6s ease-out" : "none",
          "@keyframes spin3d": {
            "0%": { transform: "rotateY(0deg)" },
            "100%": { transform: "rotateY(360deg)" },
          },
        }}
      >
        <CardImage card={card} size={size} />
      </div>
    </div>
  );
}
