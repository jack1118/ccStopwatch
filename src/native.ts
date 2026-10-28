import { Capacitor } from '@capacitor/core'
import { ActionSheet, ActionSheetButtonStyle } from '@capacitor/action-sheet'
import { Share } from '@capacitor/share'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { KeepAwake } from '@capacitor-community/keep-awake'

// iOS app（Capacitor）專用的原生能力；在瀏覽器/PWA 一律 no-op，由呼叫端走原本的 web 做法。
export const isNative = Capacitor.isNativePlatform()

/** 按圈：一下重擊觸覺（原生 UIImpactFeedbackGenerator，任何 iOS 版本都有） */
export function nativeTap(): void {
  void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {})
}

/** 休息到點：警示觸覺＋三下長震，像鬧鈴 */
export function nativeAlarm(): void {
  void Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
  for (let i = 0; i < 3; i++) setTimeout(() => void Haptics.vibrate().catch(() => {}), 150 + i * 550)
}

// 觸覺分層（web 一律 no-op，呼叫端不用判斷平台）：
// light＝門檻提示（長按紅框開始、復原）；success＝動作已生效（長按停止）；selection＝切換/加減
export function nativeLight(): void {
  if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
}
export function nativeSuccess(): void {
  if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
}
export function nativeSelection(): void {
  if (!isNative) return
  void Haptics.selectionStart().then(() => Haptics.selectionChanged()).then(() => Haptics.selectionEnd()).catch(() => {})
}

/** 破壞性動作確認：iOS app 用系統底部選單（紅字＋取消，落在拇指區）；web 維持 window.confirm */
export async function confirmDestructive(o: { title: string; message?: string; action: string; webText: string }): Promise<boolean> {
  if (!isNative) return window.confirm(o.webText)
  try {
    const { index } = await ActionSheet.showActions({
      title: o.title,
      message: o.message,
      options: [
        { title: o.action, style: ActionSheetButtonStyle.Destructive },
        { title: '取消', style: ActionSheetButtonStyle.Cancel },
      ],
    })
    return index === 0
  } catch {
    return window.confirm(o.webText)
  }
}

/** iOS app 分享檔案：先寫進 cache 再叫系統分享面板（WKWebView 不處理 <a download>）。
 *  data 為 base64（圖片）或純文字（CSV）。回傳 false＝使用者取消。 */
export async function nativeShareFile(filename: string, data: string, isBase64: boolean): Promise<boolean> {
  const path = filename.replace(/[/\\:]/g, '-')   // 課名含「10/28」，斜線會被當成子資料夾
  const { uri } = await Filesystem.writeFile({ path, data, directory: Directory.Cache, ...(isBase64 ? {} : { encoding: Encoding.UTF8 }) })
  try {
    await Share.share({ files: [uri] })
    return true
  } catch (e) {
    if (/cancel/i.test(String(e))) return false
    throw e
  }
}

export function nativeKeepAwake(on: boolean): void {
  void (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()).catch(() => {})
}

export interface RestAlert { at: number; title: string; body: string }

/** 鎖屏/切到背景時排好各組「休息到點」通知；回到前景時全部取消（前景由 app 自己嗶） */
export async function scheduleRestAlerts(alerts: RestAlert[]): Promise<void> {
  const future = alerts.filter((a) => a.at > Date.now() + 500)
  if (!future.length) return
  try {
    await LocalNotifications.schedule({
      notifications: future.map((a, i) => ({ id: i + 1, title: a.title, body: a.body, schedule: { at: new Date(a.at), allowWhileIdle: true } })),
    })
  } catch { /* 沒權限就略過 */ }
}

export async function cancelRestAlerts(): Promise<void> {
  try {
    const { notifications } = await LocalNotifications.getPending()
    if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) })
  } catch { /* 略過 */ }
}

/** 第一次進碼表頁時要通知權限（只會跳一次系統詢問） */
export function requestAlertPermission(): void {
  void LocalNotifications.requestPermissions().catch(() => {})
}
