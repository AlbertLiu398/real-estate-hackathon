// Compass maths for the compass model (Eight Mansions + Xuan Kong Flying Star).
// Bearings are true-north degrees, clockwise.

export const MOUNT = "子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬"; // 24 mountains, 子 centred on 0°
export const PALS = ["坎", "艮", "震", "巽", "离", "坤", "兑", "乾"] as const; // palaces centred on 0,45,...,315
export type Palace = (typeof PALS)[number];

export const PALACE_EN: Record<string, string> = {
  坎: "Kan (N)", 艮: "Gen (NE)", 震: "Zhen (E)", 巽: "Xun (SE)",
  离: "Li (S)", 坤: "Kun (SW)", 兑: "Dui (W)", 乾: "Qian (NW)", 中: "Centre",
};

const LUO: Record<string, number> = { 坎: 1, 坤: 2, 震: 3, 巽: 4, 中: 5, 乾: 6, 兑: 7, 艮: 8, 离: 9 };
const NUM2PAL: Record<number, string> = Object.fromEntries(Object.entries(LUO).map(([k, v]) => [v, k]));
const PATH = ["中", "乾", "兑", "艮", "离", "坎", "坤", "震", "巽"]; // Luo Shu flying order
// mountains per palace in 地, 天, 人 order
const YUAN: Record<string, string> = {
  坎: "壬子癸", 艮: "丑艮寅", 震: "甲卯乙", 巽: "辰巽巳", 离: "丙午丁", 坤: "未坤申", 兑: "庚酉辛", 乾: "戌乾亥",
};

/** Python-style modulo (always non-negative for positive m). */
export const mod = (x: number, m: number): number => ((x % m) + m) % m;

export function palOfMountain(i: number): Palace {
  return PALS[Math.floor(mod(i + 1, 24) / 3)];
}

function yang(m: string): boolean {
  const pal = Object.keys(YUAN).find((p) => YUAN[p].includes(m))!;
  const k = YUAN[pal].indexOf(m);
  if ("坎离震兑".includes(pal)) return k === 0;
  return k !== 0;
}

export function fly(v: number, fwd: boolean): Record<string, number> {
  const out: Record<string, number> = {};
  PATH.forEach((p, k) => { out[p] = mod(v - 1 + (fwd ? k : -k), 9) + 1; });
  return out;
}

export const mountIdx = (b: number): number => Math.floor(mod(b + 7.5, 360) / 15);
export const palace = (b: number): Palace => PALS[Math.floor(mod(b + 22.5, 360) / 45)];

export interface Chart {
  sitMountain: string; faceMountain: string; sitPalace: Palace; facePalace: Palace;
  mountain: Record<string, number>; // 山星 by palace
  water: Record<string, number>;    // 向星 by palace
}

/** Xuan Kong Flying Star chart for a sitting bearing. */
export function chart(sitB: number, period = 9): Chart {
  const yun = fly(period, true);
  const si = mountIdx(sitB), fi = mountIdx(mod(sitB + 180, 360));
  const sm = MOUNT[si], fm = MOUNT[fi];
  const stars = (m: string, pal: string) => {
    const v = yun[pal];
    const k = YUAN[pal].indexOf(m);
    const y = v === 5 ? yang(m) : yang(YUAN[NUM2PAL[v]][k]);
    return fly(v, y);
  };
  return {
    sitMountain: sm, faceMountain: fm, sitPalace: palOfMountain(si), facePalace: palOfMountain(fi),
    mountain: stars(sm, palOfMountain(si)), water: stars(fm, palOfMountain(fi)),
  };
}

// Eight Mansions 八宅 大游年
const YOU: Record<string, string> = {
  乾: "六天五祸绝延生", 坎: "五天生延绝祸六", 艮: "六绝祸生延天五", 震: "延生祸绝五天六",
  巽: "天五六祸生绝延", 离: "六五绝延祸生天", 坤: "天延绝生祸五六", 兑: "生祸延绝六五天",
};
const SEQ = ["乾", "坎", "艮", "震", "巽", "离", "坤", "兑"];
const STAR: Record<string, string> = { 生: "生气", 延: "延年", 天: "天医", 伏: "伏位", 绝: "绝命", 五: "五鬼", 六: "六煞", 祸: "祸害" };
export const STAR_EN: Record<string, string> = {
  生气: "Sheng Qi (vitality)", 延年: "Yan Nian (longevity)", 天医: "Tian Yi (health)", 伏位: "Fu Wei (stability)",
  绝命: "Jue Ming (total loss)", 五鬼: "Wu Gui (five ghosts)", 六煞: "Liu Sha (six killings)", 祸害: "Huo Hai (mishaps)",
};
export const GOOD = new Set(["生气", "延年", "天医", "伏位"]);

export function bazhai(house: string): Record<string, string> {
  const i = SEQ.indexOf(house);
  const res: Record<string, string> = { [house]: "伏位" };
  [...YOU[house]].forEach((ch, k) => { res[SEQ[(i + 1 + k) % 8]] = STAR[ch]; });
  return res;
}

/** Bearing: 0 = +y (north), clockwise, for a north-up (+y = north) frame. */
export const bearingNorthUp = (dx: number, dy: number): number => mod((Math.atan2(dx, dy) * 180) / Math.PI, 360);
