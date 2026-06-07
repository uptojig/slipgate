"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Check, ChevronRight, Play, Lock, KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { ENDPOINTS, type EndpointDoc, type FieldRow } from "@/lib/api-docs/catalog";

export type KeyHint = {
  id: string;
  name: string;
  keyPrefix: string;
  isSandbox: boolean;
};

type Tab = "request" | "response" | "tryit";

export function ApiDocsPanel({ keyHints }: { keyHints: KeyHint[] }) {
  const [activeId, setActiveId] = useState<string>(ENDPOINTS[0].id);
  const active = useMemo(() => ENDPOINTS.find((e) => e.id === activeId)!, [activeId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">API Endpoint</h1>
        <p className="text-sm text-zinc-600">
          เลือก endpoint ทางซ้าย — ดู schema, ทดลองยิงจริงผ่าน sandbox tester ในแท็บ &ldquo;Try it&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        <EndpointList activeId={activeId} onSelect={setActiveId} />
        <EndpointDetail key={active.id} doc={active} keyHints={keyHints} />
      </div>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────
function EndpointList({
  activeId,
  onSelect,
}: {
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const out = new Map<string, EndpointDoc[]>();
    for (const e of ENDPOINTS) {
      const list = out.get(e.group) ?? [];
      list.push(e);
      out.set(e.group, list);
    }
    return Array.from(out.entries());
  }, []);

  return (
    <aside className="card p-3 self-start lg:sticky lg:top-4">
      {groups.map(([group, items]) => (
        <div key={group} className="mb-3 last:mb-0">
          <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {group}
          </div>
          <div className="space-y-0.5">
            {items.map((e) => {
              const isActive = e.id === activeId;
              return (
                <button
                  key={e.id}
                  onClick={() => onSelect(e.id)}
                  disabled={!e.available}
                  className={`w-full text-left flex items-start gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-900 border border-brand-200"
                      : "hover:bg-zinc-50 border border-transparent"
                  } ${!e.available ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <ChevronRight
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      isActive ? "text-brand-700" : "text-zinc-400"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-zinc-500 truncate">{e.shortDescription}</div>
                  </div>
                  {!e.available && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">
                      เร็วๆ นี้
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

// ── Detail panel ─────────────────────────────────────────────────────────
function EndpointDetail({ doc, keyHints }: { doc: EndpointDoc; keyHints: KeyHint[] }) {
  const [tab, setTab] = useState<Tab>("request");

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="text-xl font-bold">{doc.title}</h2>
        <p className="text-sm text-zinc-600 mt-0.5">{doc.shortDescription}</p>

        <div className="mt-4 flex items-center gap-3 p-3 border border-zinc-200 rounded-md bg-zinc-50">
          <span className="px-2.5 py-1 rounded font-bold text-xs bg-brand-600 text-white">
            {doc.method}
          </span>
          <code className="flex-1 text-sm text-zinc-800">{doc.path}</code>
          <CopyButton value={doc.path} />
          {doc.authRequired && (
            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">
              <Lock className="h-3 w-3" /> Auth Required
            </span>
          )}
        </div>

        {doc.howTo.length > 0 && (
          <div className="mt-5">
            <h3 className="font-semibold text-sm mb-2">วิธีการใช้งาน</h3>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-zinc-700">
              {doc.howTo.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="card p-5">
        <Tabs value={tab} onChange={setTab} />
        <div className="mt-4">
          {tab === "request" && <RequestTab doc={doc} />}
          {tab === "response" && <ResponseTab doc={doc} />}
          {tab === "tryit" && <TryItTab doc={doc} keyHints={keyHints} />}
        </div>
      </div>
    </div>
  );
}

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "request", label: "Request" },
    { id: "response", label: "Response" },
    { id: "tryit", label: "Try it" },
  ];
  return (
    <div className="flex gap-2 border-b border-zinc-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors ${
            value === t.id
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Request tab ──────────────────────────────────────────────────────────
function RequestTab({ doc }: { doc: EndpointDoc }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-sm mb-2">Request Body</h3>
        <FieldTable rows={doc.request} />
      </div>
      <div>
        <h3 className="font-semibold text-sm mb-2">ตัวอย่าง</h3>
        <div className="space-y-3">
          {doc.requestExamples.map((ex, i) => (
            <CodeBlock
              key={i}
              label={ex.label}
              code={
                "__curl" in ex.body
                  ? String((ex.body as { __curl: string }).__curl)
                  : JSON.stringify(ex.body, null, 2)
              }
              language={"__curl" in ex.body ? "bash" : "json"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FieldTable({ rows }: { rows: FieldRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-zinc-500 p-4 border border-dashed rounded-md">
        ไม่มี request body
      </div>
    );
  }
  return (
    <div className="border border-zinc-200 rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50">
          <tr className="text-left text-xs text-zinc-600 uppercase">
            <th className="px-3 py-2 font-medium">Key</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Example</th>
            <th className="px-3 py-2 font-medium text-center">Required</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-zinc-100 align-top">
              <td className="px-3 py-2 font-mono text-xs text-zinc-800">{r.key}</td>
              <td className="px-3 py-2 text-zinc-600">{r.type}</td>
              <td className="px-3 py-2 text-zinc-700">
                <div>{r.description}</div>
                {r.note && <div className="text-xs text-rose-600 mt-0.5">*{r.note}</div>}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 max-w-[240px] break-all">
                {r.example}
              </td>
              <td className="px-3 py-2 text-center">
                {r.required ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 inline" />
                ) : (
                  <span className="text-zinc-300">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Response tab ─────────────────────────────────────────────────────────
function ResponseTab({ doc }: { doc: EndpointDoc }) {
  if (doc.responseExamples.length === 0) {
    return <div className="text-sm text-zinc-500">ยังไม่มีตัวอย่าง</div>;
  }
  return (
    <div className="space-y-3">
      {doc.responseExamples.map((r, i) => (
        <div key={i}>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                r.status < 300
                  ? "bg-emerald-100 text-emerald-700"
                  : r.status < 500
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
              }`}
            >
              {r.status}
            </span>
            <span className="text-sm font-medium">{r.label}</span>
          </div>
          <CodeBlock code={JSON.stringify(r.body, null, 2)} language="json" />
        </div>
      ))}
    </div>
  );
}

// ── Try-it tab ───────────────────────────────────────────────────────────
function TryItTab({ doc, keyHints }: { doc: EndpointDoc; keyHints: KeyHint[] }) {
  const initialBody = useMemo(() => {
    const ex = doc.requestExamples[0];
    if (!ex) return "{}";
    if ("__curl" in ex.body) return "{}";
    return JSON.stringify(ex.body, null, 2);
  }, [doc.id]);

  const hasPathParam = doc.path.includes("{");
  const initialPathParam = useMemo(() => {
    const m = doc.path.match(/\{(\w+)\}/);
    return m ? "" : "";
    void m;
  }, [doc.id]);

  const [apiKey, setApiKey] = useState("");
  const [body, setBody] = useState(initialBody);
  const [pathParam, setPathParam] = useState(initialPathParam);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ status: number; body: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (doc.contentType === "multipart/form-data") {
    return (
      <div className="text-sm text-zinc-600 p-4 border border-dashed rounded-md">
        Multipart endpoint — ทดลองผ่านหน้านี้ยังไม่รองรับ ใช้คำสั่ง <code>cURL</code> ในแท็บ Request แทน
      </div>
    );
  }

  const sandboxKeys = keyHints.filter((k) => k.isSandbox);
  const isGet = doc.method === "GET";

  async function run() {
    setLoading(true);
    setError(null);
    setResponse(null);
    let parsed: unknown = null;
    if (!isGet) {
      try {
        parsed = JSON.parse(body);
      } catch (e) {
        setError(`Body ไม่ใช่ JSON ที่ valid: ${(e as Error).message}`);
        setLoading(false);
        return;
      }
    }
    if (hasPathParam && !pathParam.trim()) {
      setError("กรอก path parameter ก่อน");
      setLoading(false);
      return;
    }
    const url = doc.path.replace(/\{(\w+)\}/, encodeURIComponent(pathParam.trim()));
    try {
      const res = await fetch(url, {
        method: doc.method,
        headers: {
          ...(isGet ? {} : { "Content-Type": "application/json" }),
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        ...(isGet ? {} : { body: JSON.stringify(parsed) }),
      });
      let payload: unknown;
      try {
        payload = await res.json();
      } catch {
        payload = await res.text();
      }
      setResponse({ status: res.status, body: payload });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-sm font-semibold">API Key</label>
          {sandboxKeys.length === 0 ? (
            <Link
              href="/dashboard/api-keys"
              className="text-xs text-brand-700 hover:underline flex items-center gap-1"
            >
              <KeyRound className="h-3 w-3" /> สร้าง sandbox key ก่อน
            </Link>
          ) : (
            <span className="text-xs text-zinc-500">
              คุณมี sandbox key {sandboxKeys.length} ตัว ({sandboxKeys[0].keyPrefix}…)
            </span>
          )}
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk_test_… (วาง full key ที่นี่)"
          className="input font-mono text-sm w-full"
          autoComplete="off"
        />
        <p className="text-xs text-zinc-500 mt-1">
          ใช้ sandbox key (<code>sk_test_…</code>) เพื่อทดลองโดยไม่ตัดเครดิตจริง
        </p>
      </div>

      {hasPathParam && (
        <div>
          <label className="text-sm font-semibold">Path parameter</label>
          <input
            value={pathParam}
            onChange={(e) => setPathParam(e.target.value)}
            placeholder={doc.path.match(/\{(\w+)\}/)?.[1] ?? "value"}
            className="input font-mono text-sm w-full mt-1.5"
            spellCheck={false}
          />
          <p className="text-xs text-zinc-500 mt-1">
            จะถูกเสียบเข้า <code>{doc.path}</code>
          </p>
        </div>
      )}

      {!isGet && (
        <div>
          <label className="text-sm font-semibold">Request Body (JSON)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="input font-mono text-xs w-full mt-1.5"
            spellCheck={false}
          />
        </div>
      )}

      <button onClick={run} disabled={loading} className="btn-primary">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        ทดสอบยิง
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {response && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                response.status < 300
                  ? "bg-emerald-100 text-emerald-700"
                  : response.status < 500
                    ? "bg-amber-100 text-amber-700"
                    : "bg-rose-100 text-rose-700"
              }`}
            >
              HTTP {response.status}
            </span>
            <span className="text-sm font-medium text-zinc-700">Response</span>
          </div>
          <CodeBlock
            code={
              typeof response.body === "string"
                ? response.body
                : JSON.stringify(response.body, null, 2)
            }
            language="json"
          />
        </div>
      )}
    </div>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────
function CodeBlock({
  code,
  language,
  label,
}: {
  code: string;
  language: "json" | "bash";
  label?: string;
}) {
  return (
    <div className="relative">
      {label && (
        <div className="text-xs text-zinc-500 mb-1 font-medium">{label}</div>
      )}
      <div className="relative rounded-md overflow-hidden border border-zinc-800">
        <CopyButton value={code} floating />
        <pre className="bg-zinc-900 text-zinc-100 text-xs p-3 overflow-x-auto whitespace-pre-wrap break-words">
          <code className={`language-${language}`}>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function CopyButton({ value, floating = false }: { value: string; floating?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  if (floating) {
    return (
      <button
        onClick={copy}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded bg-zinc-700/80 hover:bg-zinc-700 text-zinc-100 text-xs"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "คัดลอกแล้ว" : "คัดลอก"}
      </button>
    );
  }
  return (
    <button
      onClick={copy}
      className="p-1.5 rounded hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700"
      title="คัดลอก"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
