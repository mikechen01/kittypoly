export type CardEffect =
  | { type: "gainFood"; amount: number }
  | { type: "loseFood"; amount: number }
  | { type: "moveTo"; index: number; collectGo: boolean }
  | { type: "moveRelative"; steps: number }
  | { type: "goToCage" }
  | { type: "repair"; perHouse: number; perVilla: number };

export interface CardDef {
  id: string;
  deck: "scratch" | "teaser";
  text: string;
  effect: CardEffect;
}

export const SCRATCH_DECK: CardDef[] = [
  { id: "scratch-found-treats", deck: "scratch", text: "在貓抓板縫裡找到小魚乾，獲得 50 份食物。", effect: { type: "gainFood", amount: 50 } },
  { id: "scratch-torn-sofa", deck: "scratch", text: "抓破沙發套，賠償 40 份食物。", effect: { type: "loseFood", amount: 40 } },
  { id: "scratch-sprint-to-go", deck: "scratch", text: "磨爪後精神大好，衝回早餐起點。", effect: { type: "moveTo", index: 0, collectGo: true } },
  { id: "scratch-hide-in-cage", deck: "scratch", text: "躲進貓籠睡覺，被送到貓籠。", effect: { type: "goToCage" } },
  { id: "scratch-back-three", deck: "scratch", text: "抓板滑了一下，倒退三格。", effect: { type: "moveRelative", steps: -3 } },
  { id: "scratch-forward-five", deck: "scratch", text: "磨完爪往前巡邏五格。", effect: { type: "moveRelative", steps: 5 } },
  { id: "scratch-repair-claws", deck: "scratch", text: "貓屋被抓花，房屋每棟 25、貓別墅每棟 100。", effect: { type: "repair", perHouse: 25, perVilla: 100 } },
  { id: "scratch-window-seat", deck: "scratch", text: "被窗台陽光召喚，前往陽光窗台。", effect: { type: "moveTo", index: 1, collectGo: false } },
];

export const TEASER_DECK: CardDef[] = [
  { id: "teaser-bonus-play", deck: "teaser", text: "逗貓棒表演大成功，獲得 75 份食物。", effect: { type: "gainFood", amount: 75 } },
  { id: "teaser-knock-snacks", deck: "teaser", text: "追羽毛撞翻零食罐，損失 35 份食物。", effect: { type: "loseFood", amount: 35 } },
  { id: "teaser-chase-cage", deck: "teaser", text: "追逗貓棒追到鑽進貓籠。", effect: { type: "goToCage" } },
  { id: "teaser-laser-to-cat-tree", deck: "teaser", text: "雷射點停在小型貓爬架，立刻前往。", effect: { type: "moveTo", index: 5, collectGo: false } },
  { id: "teaser-zoomies-forward", deck: "teaser", text: "進入暴衝模式，前進八格。", effect: { type: "moveRelative", steps: 8 } },
  { id: "teaser-pounce-back", deck: "teaser", text: "撲空翻滾，倒退兩格。", effect: { type: "moveRelative", steps: -2 } },
  { id: "teaser-repair-toys", deck: "teaser", text: "玩具巡檢，房屋每棟 40、貓別墅每棟 115。", effect: { type: "repair", perHouse: 40, perVilla: 115 } },
  { id: "teaser-master-bed", deck: "teaser", text: "追到主臥大床，若經過起點照領早餐。", effect: { type: "moveTo", index: 37, collectGo: true } },
];
