import { signIn } from "@/auth";

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "このGoogleアカウントは許可されていません。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <h1>ログイン</h1>
      <p className="muted" style={{ marginBottom: "1rem" }}>
        勉強スケジュール管理アプリを使うにはGoogleアカウントでログインしてください。
      </p>
      {error && <div className="warning-box">{ERROR_MESSAGES[error] ?? "ログインに失敗しました。"}</div>}
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button type="submit" className="button-primary button-block">
          Googleでログイン
        </button>
      </form>
    </div>
  );
}
