import { getCurrentUserId } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { saveSettings } from "./actions";

export default async function SettingsPage() {
  const userId = await getCurrentUserId();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { userId } });

  return (
    <div>
      <h1>設定</h1>
      <form action={saveSettings} className="card stack">
        <div className="field">
          <label htmlFor="homeAddress">自宅住所（移動時間計算の起点）</label>
          <input id="homeAddress" name="homeAddress" defaultValue={settings.homeAddress} placeholder="例: 東京都渋谷区..." />
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="wakeWeekday">起床時刻（平日）</label>
            <input id="wakeWeekday" name="wakeWeekday" type="time" defaultValue={settings.wakeWeekday} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="wakeWeekend">起床時刻（休日）</label>
            <input id="wakeWeekend" name="wakeWeekend" type="time" defaultValue={settings.wakeWeekend} required />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="morningEnd">午前枠終了時刻</label>
            <input id="morningEnd" name="morningEnd" type="time" defaultValue={settings.morningEnd} required />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="outsideEnd">外での勉強終了時刻</label>
            <input id="outsideEnd" name="outsideEnd" type="time" defaultValue={settings.outsideEnd} required />
          </div>
        </div>
        <button type="submit" className="button-primary button-block">
          保存
        </button>
      </form>
    </div>
  );
}
