import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { FileCode, Settings2, FolderOpen, Type, FileText, MapPin, Download, Bookmark } from "lucide-react";
import "./index.css";

type InputMode = "text" | "file";

export function AddUrlApp() {
  const [url, setUrl] = useState("");
  const [downloadPath, setDownloadPath] = useState("");
  
  const [headerMode, setHeaderMode] = useState<InputMode>("text");
  const [headers, setHeaders] = useState("");
  const [headerPath, setHeaderPath] = useState("");
  
  const [bodyMode, setBodyMode] = useState<InputMode>("text");
  const [body, setBody] = useState("");
  const [bodyPath, setBodyPath] = useState("");

  const [pageHtmlMode, setPageHtmlMode] = useState<InputMode>("text");
  const [pageHtml, setPageHtml] = useState("");
  const [pageHtmlPath, setPageHtmlPath] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchClipboard = async () => {
      if (window?.ipcRenderer) {
        const text = await window.ipcRenderer.invoke("get-clipboard-text");
        if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
          setUrl(text);
          setTimeout(() => {
            if (inputRef.current) {
              inputRef.current.focus();
              inputRef.current.select();
            }
          }, 100);
        }
      }
    };
    fetchClipboard();
  }, []);

  const handleBrowse = async (type: string) => {
    if (window?.ipcRenderer) {
      if (type === "folder") {
        const path = await window.ipcRenderer.invoke("select-folder");
        if (path) setDownloadPath(path);
        return;
      }

      let title = "Select File";
      let extensions = ["*"];
      if (type === "html") {
        title = "Select page.html";
        extensions = ["html", "htm"];
      }

      const path = await window.ipcRenderer.invoke("select-file", { title, extensions });
      if (path) {
        if (type === "headers") setHeaderPath(path);
        if (type === "body") setBodyPath(path);
        if (type === "html") setPageHtmlPath(path);
      }
    }
  };

  const getPayload = () => ({
    url,
    downloadPath,
    headers: headerMode === "text" ? (headers ? JSON.parse(headers) : null) : { _filePath: headerPath },
    body: bodyMode === "text" ? body : { _filePath: bodyPath },
    pageHtml: pageHtmlMode === "text" ? pageHtml : { _filePath: pageHtmlPath }
  });

  const handleDownload = () => {
    if (url && window?.ipcRenderer) {
      window.ipcRenderer.send("add-url-confirmed", getPayload());
      window.ipcRenderer.invoke("close-add-url-window");
    }
  };

  const handleSaveLater = () => {
    if (url && window?.ipcRenderer) {
      window.ipcRenderer.send("add-url-save-later", getPayload());
      window.ipcRenderer.invoke("close-add-url-window");
    }
  };

  const handleCancel = () => {
    if (window?.ipcRenderer) {
      window.ipcRenderer.invoke("close-add-url-window");
    }
  };

  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  const SectionHeader = ({ icon: Icon, title, mode, setMode }: any) => (
    <div className="flex items-center justify-between mb-1.5 ml-1">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <label className="text-[10px] font-bold uppercase text-muted-foreground">{title}</label>
      </div>
      {setMode && (
        <div className="flex bg-muted/50 rounded p-0.5 scale-90 origin-right">
          <button 
            className={`px-2 py-0.5 rounded text-[8px] font-bold transition-colors ${mode === "text" ? "bg-background shadow-sm" : "opacity-50"}`}
            onClick={() => setMode("text")}
          >
            <div className="flex items-center gap-1"><Type className="w-2 h-2" /> INPUT</div>
          </button>
          <button 
            className={`px-2 py-0.5 rounded text-[8px] font-bold transition-colors ${mode === "file" ? "bg-background shadow-sm" : "opacity-50"}`}
            onClick={() => setMode("file")}
          >
            <div className="flex items-center gap-1"><FileText className="w-2 h-2" /> BROWSE</div>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen flex-col bg-background text-sm select-none">
      <header className="drag-css flex h-[32px] shrink-0 items-center px-4 bg-background">
        <div className="flex items-center gap-2">
          <img src="/icons/png/32x32.png" alt="Logo" className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-tight">Add New URL</span>
        </div>
      </header>
      
      <div className="flex-1 space-y-5 overflow-auto p-4 pr-3">
        {/* URL Address */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Address</label>
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste URL here..."
            className="h-9 text-xs"
          />
        </div>

        {/* Download Path */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 ml-1">
            <MapPin className="w-3 h-3 text-muted-foreground" />
            <label className="text-[10px] font-bold uppercase text-muted-foreground">Save To</label>
          </div>
          <div className="flex gap-2">
            <Input value={downloadPath} readOnly placeholder="Default download folder" className="h-9 text-[10px] flex-1 bg-muted/30" />
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleBrowse("folder")}>
              <FolderOpen className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Headers */}
        <div className="space-y-1.5">
          <SectionHeader icon={Settings2} title="Headers (JSON)" mode={headerMode} setMode={setHeaderMode} />
          {headerMode === "text" ? (
            <Textarea
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder='{"Cookie": "...", "User-Agent": "..."}'
              className="h-16 text-[10px] font-mono"
            />
          ) : (
            <div className="flex gap-2">
              <Input value={headerPath} readOnly placeholder="No file selected" className="h-9 text-[10px] flex-1 bg-muted/30" />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleBrowse("headers")}>
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <SectionHeader icon={FileText} title="Body" mode={bodyMode} setMode={setBodyMode} />
          {bodyMode === "text" ? (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Post data body..."
              className="h-16 text-[10px] font-mono"
            />
          ) : (
            <div className="flex gap-2">
              <Input value={bodyPath} readOnly placeholder="No file selected" className="h-9 text-[10px] flex-1 bg-muted/30" />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleBrowse("body")}>
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Page Source (YouTube) */}
        {isYouTube && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
            <SectionHeader icon={FileCode} title="YouTube page.html" mode={pageHtmlMode} setMode={setPageHtmlMode} />
            {pageHtmlMode === "text" ? (
              <Textarea
                value={pageHtml}
                onChange={(e) => setPageHtml(e.target.value)}
                placeholder="Paste HTML source here..."
                className="h-16 text-[10px] font-mono"
              />
            ) : (
              <div className="flex gap-2">
                <Input value={pageHtmlPath} readOnly placeholder="No file selected" className="h-9 text-[10px] flex-1 bg-muted/30" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => handleBrowse("html")}>
                  <FolderOpen className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center gap-2 mt-4 pt-2 border-t border-border/50">
        <Button variant="ghost" className="h-8 px-4 text-xs opacity-70 hover:opacity-100" onClick={handleCancel}>Cancel</Button>
        <div className="flex gap-2">
          <Button variant="outline" className="h-8 px-4 text-xs gap-1.5" onClick={handleSaveLater} disabled={!url}>
            <Bookmark className="w-3.5 h-3.5" />
            Save for Later
          </Button>
          <Button className="h-8 px-6 text-xs gap-1.5" onClick={handleDownload} disabled={!url}>
            <Download className="w-3.5 h-3.5" />
            Download Now
          </Button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <TooltipProvider>
        <AddUrlApp />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
);
