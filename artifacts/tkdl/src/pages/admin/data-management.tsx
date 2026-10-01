import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileCheck2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

const LAST_BACKUP_KEY="tkdl:last-full-backup-at";

export function DataManagement() {
  const [exporting, setExporting] = useState(false);
  const [validation, setValidation] = useState<{valid:boolean;message:string;tables?:number;rows?:number}|null>(null);
  const [preview,setPreview]=useState<any|null>(null);
  const [lastBackupAt,setLastBackupAt]=useState<string|null>(()=>localStorage.getItem(LAST_BACKUP_KEY));
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `tkdl-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      const downloadedAt=new Date().toISOString();
      localStorage.setItem(LAST_BACKUP_KEY,downloadedAt);
      setLastBackupAt(downloadedAt);
      toast({ title: "Backup downloaded", description: "Full JSON snapshot saved to your device" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
    setExporting(false);
  };

  const parsedBackupAt=lastBackupAt?Date.parse(lastBackupAt):NaN;
  const backupAgeDays=Number.isFinite(parsedBackupAt)?Math.floor((Date.now()-parsedBackupAt)/86_400_000):null;
  const backupIsRecent=backupAgeDays!==null&&backupAgeDays<7;

  const validateBackup = async (file: File | undefined) => {
    if (!file) return;
    setPreview(null);
    try {
      const parsed = JSON.parse(await file.text());
      if (parsed?.format !== "tkdl-league-backup" || !["2.0","3.0"].includes(parsed?.version) || !parsed?.data || !parsed?.manifest) throw new Error("This is not a supported TKDL backup");
      const required = parsed.version === "3.0"
        ? ["players","matches","match_participants","seasons","achievements","doubles_teams","doubles_matches","shift_wars_teams","shift_wars_matches","admin_audit_log"]
        : ["players","matches","matchParticipants","seasons","achievements","doublesTeams","doublesMatches","shiftWarsTeams","shiftWarsMatches","auditLog"];
      for (const key of required) if (!Array.isArray(parsed.data[key])) throw new Error(`Missing or invalid ${key} table`);
      for (const [key,count] of Object.entries(parsed.manifest)) if (!Array.isArray(parsed.data[key]) || parsed.data[key].length !== count) throw new Error(`${key} row count does not match its manifest`);
      const tables=Object.keys(parsed.manifest).length; const rows=(Object.values(parsed.manifest) as unknown[]).reduce<number>((n,v)=>n+Number(v),0);
      setValidation({valid:true,message:`Valid TKDL backup from ${new Date(parsed.exportedAt).toLocaleString()}`,tables,rows});
      if(parsed.version==="3.0"){
        const response=await fetch("/api/admin/backup/preview",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({format:parsed.format,version:parsed.version,exportedAt:parsed.exportedAt,manifest:parsed.manifest})});
        const comparison=await response.json();
        if(!response.ok)throw new Error(comparison.error??"Could not compare this backup with the live database");
        setPreview(comparison);
      }
    } catch(e:any) { setValidation({valid:false,message:e?.message??"Invalid backup file"}); }
    if(fileRef.current) fileRef.current.value="";
  };

  return (
    <CollapsibleAdminSection title="Data Backup" icon={Download} accent="#6ab0ff">
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Export a versioned JSON snapshot of the complete league and app content, including TKDL Live, interviews, community, Singles, uneven teams, Doubles, Shift Wars, Tour progress, Card Clash and admin history.
        </p>
        <div className="rounded-lg p-3 flex items-start gap-3" style={{background:backupIsRecent?"rgba(34,197,94,.05)":"rgba(255,210,74,.045)",border:`1px solid ${backupIsRecent?"rgba(34,197,94,.22)":"rgba(255,210,74,.22)"}`}}>
          {backupIsRecent?<ShieldCheck className="w-5 h-5 shrink-0" style={{color:"#22c55e"}}/>:<AlertTriangle className="w-5 h-5 shrink-0" style={{color:"#ffd24a"}}/>}
          <div><strong className="text-sm" style={{color:backupIsRecent?"#86efac":"#fde68a"}}>{backupIsRecent?"Recent backup recorded":"Backup recommended"}</strong><p className="text-xs text-white/45 mt-0.5">{backupAgeDays===null?"No full backup download has been recorded in this browser yet.":backupAgeDays===0?`Last downloaded today at ${new Date(lastBackupAt!).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}.`:`Last downloaded ${backupAgeDays} day${backupAgeDays===1?"":"s"} ago on this device.`}</p>{!backupIsRecent&&<p className="text-[11px] text-white/30 mt-1">Download a fresh copy before a season reset or a major correction.</p>}</div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          style={{ background: exporting ? "rgba(106,176,255,0.06)" : "rgba(106,176,255,0.12)", border: "1px solid rgba(106,176,255,0.3)", color: "#6ab0ff", fontFamily: "Oswald, sans-serif" }}
        >
          {exporting ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#6ab0ff" }} />Preparing…</>
          ) : (
            <><Download className="w-3.5 h-3.5" />Download Full Backup</>
          )}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>void validateBackup(e.target.files?.[0])}/>
        <button onClick={()=>fileRef.current?.click()} className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95"
          style={{background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.25)",color:"#22c55e",fontFamily:"Oswald, sans-serif"}}>
          <FileCheck2 className="w-3.5 h-3.5"/>Validate Backup File
        </button>
        {validation&&<div className="flex items-start gap-2 rounded-lg p-3 text-sm" style={{background:validation.valid?"rgba(34,197,94,.05)":"rgba(255,0,92,.05)",border:`1px solid ${validation.valid?"rgba(34,197,94,.22)":"rgba(255,0,92,.22)"}`,color:validation.valid?"#86efac":"#ff7aa8"}}>
          {validation.valid&&<CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0"/>}<div><strong>{validation.valid?"Backup passed validation":"Backup failed validation"}</strong><div className="text-xs opacity-70 mt-0.5">{validation.message}{validation.valid&&` · ${validation.tables} tables · ${validation.rows} rows`}</div></div>
        </div>}
        {preview&&<div className="rounded-xl p-3 sm:p-4 space-y-3" style={{background:"rgba(56,189,248,.04)",border:"1px solid rgba(56,189,248,.18)"}}>
          <div><strong className="text-sm" style={{color:"#7dd3fc"}}>Read-only restore preview</strong><p className="text-xs text-white/40 mt-0.5">The backup contains {preview.backupRows.toLocaleString()} rows. Only table names and counts were sent for this comparison.</p></div>
          <div className="grid grid-cols-3 gap-2 text-center"><div><strong className="text-lg">{preview.comparisons.length}</strong><div className="text-[9px] uppercase text-white/30">Compared</div></div><div><strong className="text-lg" style={{color:"#ffd24a"}}>{preview.comparisons.filter((x:any)=>x.delta!==0).length}</strong><div className="text-[9px] uppercase text-white/30">Count changes</div></div><div><strong className="text-lg" style={{color:preview.tablesMissingFromBackup.length?"#ff7aa8":"#86efac"}}>{preview.tablesMissingFromBackup.length}</strong><div className="text-[9px] uppercase text-white/30">Missing tables</div></div></div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-white/[.07]">{preview.comparisons.slice(0,30).map((row:any)=><div key={row.table} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 py-1.5 text-xs border-b border-white/[.05] last:border-0"><span className="truncate text-white/55">{row.table}</span><span className="text-white/35">live {row.currentRows??"—"}</span><span style={{color:row.delta===0?"#86efac":row.delta>0?"#38bdf8":"#ffd24a"}}>{row.delta===null?"unavailable":row.delta===0?"same":`${row.delta>0?"+":""}${row.delta}`}</span></div>)}</div>
          {preview.tablesMissingFromBackup.length>0&&<p className="text-xs" style={{color:"#ffd24a"}}>Newer live tables absent from this backup: {preview.tablesMissingFromBackup.join(", ")}.</p>}
          <p className="text-[11px] text-white/30">Restore is deliberately still disabled. This preview confirms coverage before a reversible restore workflow is enabled.</p>
        </div>}
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
          Password hashes, login sessions, device push addresses and temporary job locks are excluded for security. File contents stay in your browser; only the manifest is compared with live table counts. Nothing is restored or changed.
        </p>
      </div>
    </CollapsibleAdminSection>
  );
}
