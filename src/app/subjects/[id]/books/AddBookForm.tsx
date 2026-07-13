"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookInfoDraft, SupportedImageMediaType } from "@/lib/ai/bookVision";

export function AddBookForm({
  subjectId,
  scanBookCoverAction,
  createBookAction,
}: {
  subjectId: string;
  scanBookCoverAction: (base64: string, mediaType: SupportedImageMediaType) => Promise<BookInfoDraft | null>;
  createBookAction: (subjectId: string, formData: FormData) => Promise<void>;
}) {
  const [scanning, setScanning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const [draft, setDraft] = useState<BookInfoDraft | null>(null);
  const [coverDataUrl, setCoverDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setScanFailed(false);

    const dataUrl = await readFileAsDataUrl(file);
    setCoverDataUrl(dataUrl);

    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (match) {
      const [, mediaType, base64] = match;
      const result = await scanBookCoverAction(base64, mediaType as SupportedImageMediaType);
      if (result) setDraft(result);
      else setScanFailed(true);
    }
    setScanning(false);
  }

  async function handleSubmit(formData: FormData) {
    if (coverDataUrl) formData.set("coverImageUrl", coverDataUrl);
    setSaving(true);
    await createBookAction(subjectId, formData);
    setSaving(false);
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="card stack">
      <div className="field">
        <label htmlFor="cover">📷 表紙を撮影・選択（任意）</label>
        <input id="cover" type="file" accept="image/*" onChange={handleFileChange} disabled={scanning} />
      </div>
      {scanning && <p className="muted">AIが表紙を解析中...</p>}
      {scanFailed && <p className="muted">AI解析に失敗しました。手動で入力してください。</p>}
      {coverDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverDataUrl} alt="表紙プレビュー" style={{ maxWidth: "120px", borderRadius: "0.5rem" }} />
      )}

      <div key={draft ? JSON.stringify(draft) : "empty"} className="stack">
        <div className="field">
          <label htmlFor="title">タイトル</label>
          <input id="title" name="title" required defaultValue={draft?.title ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="publisher">出版社</label>
          <input id="publisher" name="publisher" defaultValue={draft?.publisher ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="totalPages">総ページ数</label>
          <input id="totalPages" name="totalPages" type="number" min={1} defaultValue={draft?.totalPages ?? ""} />
          <span className="muted" style={{ fontSize: "0.75rem" }}>
            AIによる推定値です。実物で確認してください。
          </span>
        </div>
      </div>

      <button type="submit" className="button-primary button-block" disabled={saving}>
        {saving ? "追加中..." : "参考書を追加"}
      </button>
    </form>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
