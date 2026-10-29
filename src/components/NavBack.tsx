import { IonButtons, IonBackButton } from '@ionic/react'

/** iOS 導覽列左上「‹ 上一頁」：外觀與轉場用 IonBackButton，點擊走 App 的 back()（沒上一頁時換成清單）。
 *  IonBackButton 的型別沒開 onClick，但 React 包裝會讓傳入的 onClick 蓋過內建的路由返回。 */
export function NavBack({ text, onBack }: { text: string; onBack: () => void }) {
  const click = { onClick: onBack }
  return <IonButtons slot="start"><IonBackButton text={text} defaultHref="/list" {...click} /></IonButtons>
}
