// ============================================================
// 演示模式（mock）种子数据
//
// 字段与 supabase/migrations/00001_create_wenzang_schema.sql 一致；
// 前 15 条纹样、3 位守艺人、3 个体验项目、3 件商品沿用 00002 迁移的骨架与文案，
// 其余按同一风格扩写，用于离线演示。
//
// 合规口径：
//  - 纹样名称取公开民俗资料中通行的传统纹样名（蜡染 / 扎染 / 苗绣各 15 条）；
//  - 守艺人为**完全虚构的示例人物**，姓名不取自任何真实传承人，
//    列表与详情页统一标注「示例档案」；
//  - 文案均为自行组织的客观叙述，不搬运受版权保护的文字。
//
// 数据规模：45 条纹样 / 10 位守艺人 / 10 件商品 / 7 个体验项目。
// 档案深化内容（工艺流程 / 文化故事 / 应用场景 / 相关纹样）
// 由 patternArchive.ts 按 id 合并进来。
// ============================================================

import type {
  Pattern,
  Artisan,
  ExperienceProject,
  Product,
  Booking,
  Order,
  AiPattern,
  PatternCategory,
} from "@/types/types";
import { withArchive } from "./patternArchive";

const IMG = (id: string) => `https://miaoda-site-img.cdn.bcebos.com/images/${id}`;

/** 演示配图池（断网时统一显示为空白占位，不影响任何功能流程） */
const IMG_POOL = [
  "baidu_image_search_225586e4-9f56-4cd9-89e5-fdbbaca317ac.jpg",
  "baidu_image_search_69d24cd9-bd4d-432e-bd92-c1adc4378286.jpg",
  "baidu_image_search_1c86ae44-51c7-43e4-a3d6-fb9398d0a813.jpg",
  "baidu_image_search_cef52ebf-6761-473b-b9b5-907307225409.jpg",
  "baidu_image_search_8fcba87a-7089-4003-943e-511a4816f5d0.jpg",
  "baidu_image_search_dd1dbd96-24f5-4e10-80ff-e5cd56e8a824.jpg",
  "baidu_image_search_94483dd0-b454-4bf6-89aa-c275e1d6adf9.jpg",
  "baidu_image_search_da036b9d-3498-4494-abe4-baa179567fdb.jpg",
  "baidu_image_search_cb1f5abb-f746-48c2-8dc9-28340dbdee1e.jpg",
  "baidu_image_search_1483e681-9a1e-4d71-8323-ec10f53440bd.jpg",
  "baidu_image_search_1fc81214-b2ea-4437-8b96-909fee7a813d.jpg",
  "MiaoTu_0e0c17de-c176-4325-9570-6ae265eba587.jpg",
];

/* ---------- id 与时间的统一生成器 ----------
   序号式 id 便于在档案表里互相引用（related_patterns）；
   时间按序号均匀递推，保证列表排序稳定且唯一。 */
const pid = (n: number) => `p${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const aid = (n: number) => `a${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const gid = (n: number) => `g${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const eid = (n: number) => `e${String(n).padStart(7, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const DAY = 86_400_000;
const at = (startMs: number, stepDays: number, n: number) =>
  new Date(startMs + n * stepDays * DAY).toISOString();
const patternDate = (n: number) => at(Date.UTC(2024, 2, 1), 3, n);
const artisanDate = (n: number) => at(Date.UTC(2024, 2, 2), 1, n);
const projectDate = (n: number) => at(Date.UTC(2024, 4, 1), 2, n);
const productDate = (n: number) => at(Date.UTC(2024, 5, 1), 2, n);

/**
 * 种子版本号：mock 层据此判断本地存量数据是否需要重建。
 * 演示内容或字段结构升级时递增，老浏览器里的存量数据刷新即自动跟上，不必手动清库。
 */
export const SEED_VERSION = 3;

// ---------- 演示账号 ----------
// 管理员：admin@miaoda.com / wencang2026（登录时输入 admin / wencang2026）
// 普通用户：demo@miaoda.com / demo123456
export const MOCK_ADMIN_EMAIL = "admin@miaoda.com";
export const MOCK_USERS = [
  { id: "u-admin-0001", email: MOCK_ADMIN_EMAIL, password: "wencang2026", role: "admin" as const },
  { id: "u-demo-0001", email: "demo@miaoda.com", password: "demo123456", role: "user" as const },
  { id: "u-lin-0001", email: "lin@miaoda.com", password: "demo123456", role: "user" as const },
];

// ---------- 守艺人（10 位，均为虚构示例档案） ----------
const art = (
  n: number,
  name: string,
  title: string,
  region: string,
  craft: PatternCategory,
  works: string,
  bio: string,
): Artisan => ({
  id: aid(n),
  name,
  title,
  region,
  craft,
  works,
  bio,
  image_url: IMG(IMG_POOL[n % IMG_POOL.length]),
  created_at: artisanDate(n),
});

export const MOCK_ARTISANS: Artisan[] = [
  art(1, "潘阿秀", "省级非遗传承人（示例）", "贵州 · 凯里", "苗绣", "蝴蝶妈妈绣、枫蚕纹绣片",
    "凯里苗绣绣娘，自幼在母亲与祖母的绣绷边长大，擅长平绣与堆绣，配色浓烈、构图饱满，作品多取材于创世古歌里的形象。（示例档案）"),
  art(2, "韦小凤", "州级非遗传承人（示例）", "贵州 · 丹寨", "蜡染", "蝶恋花靛蓝纹、涡妥纹蜡染布",
    "丹寨蜡染手艺人，以铜蜡刀徒手起稿见长，落刀不描、一气呵成，最擅长把山野花草与螺旋纹组合进同一幅蓝白布。（示例档案）"),
  art(3, "杨桂彩", "省级非遗传承人（示例）", "云南 · 大理", "扎染", "云纹扎染布、板蓝根渐变长巾",
    "大理扎染手艺人，随家中长辈学习缝扎与下缸，能凭缸水气味判断染液状态，作品以云气与花蝶的晕边自然著称。（示例档案）"),
  art(4, "吴良花", "州级非遗传承人（示例）", "贵州 · 台江", "苗绣", "百鸟衣绣片、锦鸡纹袖片",
    "台江施洞一带的绣娘，精于锁绣与辫绣，做百鸟衣一类的重工件时习惯把丝线破成八瓣，绣面细密而有光。（示例档案）"),
  art(5, "王阿引", "县级非遗传承人（示例）", "贵州 · 六枝梭嘎", "蜡染", "太阳纹蜡染头帕、井字纹衣襟",
    "六枝梭嘎的蜡染手艺人，沿用点洞花与几何底纹的老样式，构图方整、留白讲究，多为本寨妇女制作盛装衣料。（示例档案）"),
  art(6, "董月兰", "州级非遗传承人（示例）", "云南 · 喜洲", "扎染", "喜鹊登梅扎染桌布、如意纹门帘",
    "喜洲扎染作坊主人，擅长针缝与捆扎并用，同一幅布上能同时出现细密的花鸟与大块的云团留白。（示例档案）"),
  art(7, "万阿先", "省级非遗传承人（示例）", "贵州 · 雷山", "苗绣", "窝妥纹衣领绣片、梯田纹围腰",
    "雷山苗绣绣娘，最重视衣领上的窝妥纹，认为那是给祖先看的记号；她做的绣片针脚匀停，以青黑为底、朱黄点睛。（示例档案）"),
  art(8, "莫朝秀", "州级非遗传承人（示例）", "贵州 · 镇宁", "蜡染", "鹭鸶纹蜡染帐檐、螺蛳纹包袱布",
    "镇宁布依族蜡染手艺人，常用铜刀点出细密的鱼鳞与螺蛳底纹，善画水边的鹭鸶与游鱼，画面安静而有秩序。（示例档案）"),
  art(9, "宋引兰", "县级非遗传承人（示例）", "贵州 · 黄平", "苗绣", "马樱花纹背扇、星辰纹童帽",
    "黄平苗绣手艺人，多做背扇与童帽一类的贴身物件，喜欢把马缨花与星点排成圈，取花好月圆、孩子平安的口彩。（示例档案）"),
  art(10, "李灿梅", "州级非遗传承人（示例）", "云南 · 大理", "扎染", "疙瘩花扎染方巾、苍山雪月挂帘",
    "在洱海边长大的扎染手艺人，偏爱折叠夹压出的直角与雪线，认为蓝白两色足以做出山水的分层，不必再借别的颜色。（示例档案）"),
];

// ---------- 纹样（45 条：蜡染 15 / 扎染 15 / 苗绣 15） ----------
const pat = (
  n: number,
  name: string,
  category: PatternCategory,
  region: string,
  technique: string,
  meaning: string,
): Pattern => ({
  id: pid(n),
  name,
  category,
  region,
  technique,
  meaning,
  image_url: IMG(IMG_POOL[(n * 5) % IMG_POOL.length]),
  created_at: patternDate(n),
});

const DANZHAI = "贵州 · 丹寨";
const KAILI = "贵州 · 凯里";
const TAIJIANG = "贵州 · 台江";
const LEISHAN = "贵州 · 雷山";
const HUANGPING = "贵州 · 黄平";
const SUOGA = "贵州 · 六枝梭嘎";
const ZHENNING = "贵州 · 镇宁";
const SHIBING = "贵州 · 施秉";
const CHOUCHENG = "云南 · 周城";
const DALI = "云南 · 大理";
const XIZHOU = "云南 · 喜洲";

const WAX = "蜡刀点蜡、靛蓝浸染";
const TIE = "扎结、板蓝根浸染";
const EMB = "平绣、堆绣";

const MOCK_PATTERNS_BASE: Pattern[] = [
  /* ---------------- 蜡染 15 ---------------- */
  pat(1, "蝶恋花靛蓝纹", "蜡染", DANZHAI, WAX,
    "蝶恋花纹样以蝴蝶与花卉交织，寓意万物相生、生生不息，是丹寨苗族对自然与生命的礼赞。"),
  pat(4, "铜鼓纹蜡染", "蜡染", DANZHAI, WAX,
    "铜鼓纹源自苗族铜鼓纹饰，象征权力与族群凝聚，是蜡染中最古老庄严的纹样之一。"),
  pat(6, "蝴蝶纹蜡染", "蜡染", DANZHAI, WAX,
    "蝴蝶纹象征蜕变与重生，靛蓝底色上白蝶翩跹，寄托苗族对生命循环的哲思。"),
  pat(10, "铜鼓云雷纹", "蜡染", DANZHAI, WAX,
    "云雷纹回旋连绵，取意天雷鼓动、风调雨顺，是蜡染中最具秩序感的几何纹样。"),
  pat(12, "鱼鸟纹蜡染", "蜡染", DANZHAI, WAX,
    "鱼与鸟同框，取“鱼鸟相戏”之意，象征丰饶与自由，寄托对五谷丰登的祈愿。"),
  pat(14, "万字纹蜡染", "蜡染", HUANGPING, WAX,
    "万字纹连绵不断，寓意绵长不绝、福泽久远，多用于被面与头巾等日常织物。"),
  pat(16, "蕨菜纹蜡染", "蜡染", DANZHAI, WAX,
    "蕨菜春生、嫩叶卷而向上，纹样取其舒展之态，寓意生机与复苏，是山野题材里最朴素的一种。"),
  pat(17, "涡妥纹蜡染", "蜡染", DANZHAI, "蜡刀点蜡、螺旋纹",
    "涡妥是苗语对螺旋纹的称呼，一圈套一圈，老辈说它既是水涡也是山路，记着迁徙路上的弯弯绕绕。"),
  pat(18, "太阳纹蜡染", "蜡染", SUOGA, "蜡刀点蜡、放射芒纹",
    "中心一轮太阳、外放光芒，是山地人家对日照与农时的敬重，多见于头帕与盛装背部。"),
  pat(19, "鹭鸶纹蜡染", "蜡染", ZHENNING, "铜刀点蜡、靛蓝浸染",
    "鹭鸶立于水田，姿态清简，布依族把它画在帐檐上，取一路清净、岁岁安澜之意。"),
  pat(20, "石榴纹蜡染", "蜡染", DANZHAI, WAX,
    "石榴多子、剖面即成花，纹样以密集籽粒寄托人丁兴旺、团圆美满的盼望。"),
  pat(21, "牛角纹蜡染", "蜡染", DANZHAI, "蜡刀点蜡、几何纹",
    "水牛是山家的家当，牛角纹以两道弯弧象征力量与富足，常与铜鼓纹同置于盛装。"),
  pat(22, "螺蛳纹蜡染", "蜡染", ZHENNING, "铜刀点蜡、细密底纹",
    "田螺与螺蛳是水田丰饶的信号，小小一圈螺纹，寓意有吃有穿、日子不断。"),
  pat(23, "枫木纹蜡染", "蜡染", DANZHAI, WAX,
    "古歌里枫木心生蝴蝶，枫木纹因此被看作万物的来处，多用于衣背与神帐。"),
  pat(24, "井字纹蜡染", "蜡染", SUOGA, "蜡刀点蜡、方格底纹",
    "井字方格横竖等距，像梯田也像阡陌，是几何底纹中最易上手、也最考验齐整的一种。"),

  /* ---------------- 扎染 15 ---------------- */
  pat(3, "云纹扎染布", "扎染", DALI, TIE,
    "云纹象征吉祥如意、风调雨顺，白族扎染以云气流动之态寄托对美好生活的祈愿。"),
  pat(7, "植物染扎染布", "扎染", DALI, "扎结、植物浸染",
    "以天然植物染料反复浸染，纹样自然晕染，体现白族崇尚自然、天人合一的审美。"),
  pat(11, "白族蝶纹扎染", "扎染", CHOUCHENG, TIE,
    "白族视蝴蝶为忠贞与美好的象征，蝶纹扎染常作嫁妆，寓意比翼连枝、和美一生。"),
  pat(13, "板蓝根渐变扎染", "扎染", DALI, "多次浸染、氧化显色",
    "以浸染次数控制蓝色深浅，由月白至靛青层层过渡，寓意岁月沉淀、历久弥新。"),
  pat(25, "蝴蝶花扎染", "扎染", CHOUCHENG, "缝扎花纹、板蓝根浸染",
    "蝶形由缝线抽紧后自然留白，两翅相连，白族人家嫁女时常备，取「蝶来花开」的口彩。"),
  pat(26, "梅花间竹扎染", "扎染", XIZHOU, "针缝加捆扎、板蓝根浸染",
    "梅枝与竹节相间成纹，取岁寒不凋之意，多用于书斋帘幕与茶席。"),
  pat(27, "兰花纹扎染", "扎染", XIZHOU, TIE,
    "兰叶以一笔长撇见功夫，扎出的边缘自然晕开，恰合兰花清瘦之态。"),
  pat(28, "菊花纹扎染", "扎染", DALI, "捆扎成团、放射留白",
    "菊花瓣由中心向外放射，扎结的疏密决定花瓣的粗细，是扎染里最见手法的一种花头。"),
  pat(29, "喜鹊登梅扎染", "扎染", CHOUCHENG, "缝扎鸟形与枝形",
    "喜鹊立于梅梢，是「喜上眉梢」的谐音图样，白族多做门帘与帐檐，开门见喜。"),
  pat(30, "鲤鱼戏莲扎染", "扎染", DALI, "缝扎鱼形、夹压莲叶",
    "鱼穿莲叶、莲抱鱼身，寓意连年有余，常见于孩童衣料与厨房围裙。"),
  pat(31, "如意纹扎染", "扎染", XIZHOU, "折叠夹板、靛蓝浸染",
    "如意头三弯相续，以折叠夹压做出齐整边线，取事事如意、平顺无灾。"),
  pat(32, "十字花扎染", "扎染", DALI, "捆扎成十字结",
    "十字结是最基础的扎法，四向对称、密集成地纹，新手由此入门，老手用它铺底。"),
  pat(33, "苍山雪月扎染", "扎染", DALI, "分层浸染、夹压雪线",
    "取「苍山雪、洱海月」的意象，上为山形雪线、下为水月波纹，是大理风花雪月的蓝白写法。"),
  pat(34, "疙瘩花扎染", "扎染", CHOUCHENG, "徒手撮扎、板蓝根浸染",
    "把布随手撮起成一个个疙瘩扎紧，染后展开自成一圈圈的白花，全凭手感，无样可摹。"),
  pat(35, "凤凰朝阳扎染", "扎染", DALI, "缝扎羽尾与日轮",
    "凤尾舒张环绕日轮，是扎染里构图最大胆的一类，多用于堂屋挂帘与被面中心。"),

  /* ---------------- 苗绣 15 ---------------- */
  pat(2, "蝴蝶妈妈绣", "苗绣", KAILI, EMB,
    "蝴蝶妈妈是苗族创世神话中的始祖，绣于衣襟寓意族群繁衍、子孙绵延，是苗绣中最具神性的纹样。"),
  pat(5, "百鸟纹绣片", "苗绣", KAILI, "锁绣、平绣",
    "百鸟纹以群鸟环绕构图，寓意百鸟朝凤、吉祥纳福，常绣于盛装衣袖，彰显华贵。"),
  pat(8, "百鸟衣绣片", "苗绣", KAILI, "平绣、锁绣",
    "百鸟衣是苗族盛装礼服，衣身缀满鸟纹绣片，寓意族群如百鸟齐飞、生生不息。"),
  pat(9, "锦鸡纹袖片", "苗绣", TAIJIANG, "堆绣、打籽绣",
    "锦鸡在苗族传说中是引路的神鸟，绣于袖口寓意吉祥引路、前程似锦。"),
  pat(15, "蝴蝶妈妈衣襟绣", "苗绣", KAILI, "平绣、辫绣",
    "衣襟处的蝴蝶妈妈以五彩丝线盘绕而成，是苗族母亲为女儿缝制的护身祝福。"),
  pat(36, "窝妥纹衣领绣片", "苗绣", LEISHAN, "辫绣、锁绣",
    "窝妥是苗语里的螺旋纹，绣在衣领与背部，老辈说它是迁徙途中渡过的水涡，记着来路。"),
  pat(37, "江河纹绣衣", "苗绣", TAIJIANG, "平绣、挑花",
    "以曲折的横线与波纹记江河，苗家把它绣在衣裳上，被读作一部不识字的家谱。"),
  pat(38, "苗龙纹绣片", "苗绣", TAIJIANG, "辫绣、堆绣",
    "苗龙有牛龙、蛇龙、鱼龙、蜈蚣龙诸相，不主威严而主护佑，可绣于衣、背扇与伞帘。"),
  pat(39, "凤鸟纹绣片", "苗绣", KAILI, "平绣、打籽绣",
    "凤鸟与百鸟不同，独只而尾长，多为祥瑞之兆，常与太阳纹相对呼应。"),
  pat(40, "蛙纹背扇", "苗绣", LEISHAN, "堆绣、贴布绣",
    "蛙鸣雨至、腹中多子，蛙纹绣在背扇上，是把丰饶与生育的祝愿贴着孩子的背。"),
  pat(41, "鱼纹袖口绣片", "苗绣", TAIJIANG, "挑花、平绣",
    "鱼多子、生于稻水之下，鱼纹绣于袖口与裤脚，取有余、取繁衍。"),
  pat(42, "马樱花纹背扇", "苗绣", HUANGPING, "堆绣、盘线",
    "马缨花红艳成团，山地人家把它绣在背扇中心，花好则人安。"),
  pat(43, "星辰纹童帽", "苗绣", KAILI, "挑花、锁绣",
    "以细密方格排成星点，戴在孩童头上，取星斗护身、夜行不迷之意。"),
  pat(44, "梯田纹围腰", "苗绣", LEISHAN, "平绣、挑花",
    "一层层横阶状的几何纹来自梯田，是稻作山地的日常之形，也是「有田有收」的凭据。"),
  pat(45, "枫蚕纹绣片", "苗绣", SHIBING, "辫绣、平绣",
    "枫与蚕并置：古歌里枫木生蝴蝶，蚕则吐丝成衣，两样都是「身上之物」的源头。"),
];

/** 45 条纹样（含档案深化字段） */
export const MOCK_PATTERNS: Pattern[] = withArchive(MOCK_PATTERNS_BASE);

// ---------- 体验项目（7 个） ----------
const proj = (
  n: number,
  artisanNo: number,
  name: string,
  description: string,
  duration: string,
): ExperienceProject => ({
  id: eid(n),
  artisan_id: aid(artisanNo),
  name,
  description,
  duration,
  created_at: projectDate(n),
});

export const MOCK_PROJECTS: ExperienceProject[] = [
  proj(1, 1, "苗绣基础体验：绣一枚蝴蝶纹样",
    "在绣娘指导下认识绣绷与破线，用平绣完成一枚蝴蝶纹小绣片，收针锁边后自行带走。", "半天"),
  proj(2, 2, "蜡染工艺体验：蜡刀点蜡与靛染",
    "先练蜡刀控温与走线，在白手帕上徒手绘样，再入靛缸浸染、沸水脱蜡，成品当日带走。", "全天"),
  proj(3, 3, "扎染技法体验：捆扎与板蓝根染",
    "学习三种基础扎结法，方巾扎好后入植物染缸反复浸染，拆线展开即成独一无二的云纹。", "半天"),
  proj(4, 7, "苗绣进阶：辫绣与背扇纹样",
    "面向有基础的学员，练习辫绣的盘绕与填色，两天完成一块小型背扇中心纹样，作品可带走。", "两天"),
  proj(5, 5, "梭嘎蜡染几何纹体验",
    "以点洞花与井字底纹为主，学习几何纹的分格与等距走线，完成一条桌巾并带走。", "全天"),
  proj(6, 6, "白族扎染小院一日：从扎结到晾布",
    "在喜洲的扎染小院里完成构图、缝扎、下缸、拆线、晾晒全流程，带走一方桌布。", "全天"),
  proj(7, 9, "亲子苗绣：给孩子的星辰纹童帽",
    "家长与孩子各持一针，以挑花完成童帽上的星点纹样，材料包与成品一并带走。", "半天"),
];

// ---------- 文创商品（10 件，每件关联一位守艺人） ----------
const prod = (
  n: number,
  artisanNo: number,
  name: string,
  price: number,
  craft_description: string,
): Product => {
  const maker = MOCK_ARTISANS[artisanNo - 1];
  return {
    id: gid(n),
    name,
    price,
    craft_description,
    artisan_id: maker.id,
    artisan_name: maker.name,
    image_url: IMG(IMG_POOL[(n * 3) % IMG_POOL.length]),
    created_at: productDate(n),
  };
};

export const MOCK_PRODUCTS: Product[] = [
  prod(1, 2, "蝶恋花靛蓝蜡染围巾", 368,
    "以传统蜡染工艺手工制作，靛蓝底色点缀蝶恋花纹样，天然植物染料上色，透气亲肤。"),
  prod(2, 1, "蝴蝶妈妈绣片摆件", 588,
    "苗绣手工绣制，平绣与堆绣结合，色彩浓烈，可作家居装饰与收藏。"),
  prod(3, 3, "云纹扎染桌布", 298,
    "白族扎染工艺制作，板蓝根植物染料反复浸染，蓝白云纹自然晕染，环保健康。"),
  prod(4, 7, "窝妥纹苗绣背扇", 880,
    "雷山苗绣辫绣工艺，领口与背心满布螺旋纹与花鸟，手工锁边，可作新生儿背负与陈列。"),
  prod(5, 6, "喜鹊登梅扎染门帘", 246,
    "喜洲扎染缝扎与捆扎并用，长幅通铺，蓝白分明，透光不透影。"),
  prod(6, 5, "太阳纹蜡染头帕", 198,
    "六枝梭嘎传统几何样式，铜刀点蜡、靛蓝多次叠染，日轮芒纹清晰耐看。"),
  prod(7, 4, "锦鸡纹刺绣袖片一对", 640,
    "台江施洞堆绣与打籽绣结合，一对袖片成色一致，可拆镶于旧衣或装框陈列。"),
  prod(8, 8, "鹭鸶纹布依蜡染帐檐", 458,
    "镇宁布依族蜡染，细密鱼鳞底纹托出水边鹭鸶，长幅帐檐，手工脱蜡。"),
  prod(9, 10, "苍山雪月扎染挂帘", 396,
    "以折叠夹压做出山形雪线与水面波纹，深浅层次来自同一缸靛蓝，宜作书房挂帘。"),
  prod(10, 9, "马樱花纹童帽", 228,
    "黄平苗绣挑花与盘线结合，帽心一圈马缨花，内衬软布，适合婴幼儿日常。"),
];

// ---------- 预约示例（供管理员视角演示） ----------
export const MOCK_BOOKINGS: Booking[] = [
  {
    id: "b0000001-0000-4000-8000-000000000001",
    user_id: "u-demo-0001",
    artisan_id: aid(2),
    project_id: eid(2),
    artisan_name: "韦小凤",
    project_name: "蜡染工艺体验：蜡刀点蜡与靛染",
    book_date: "2025-03-18",
    time_slot: "全天 09:00-16:00",
    contact_name: "演示用户",
    contact_phone: "13800000001",
    status: "待确认",
    created_at: "2025-03-10T09:12:00.000Z",
  },
  {
    id: "b0000002-0000-4000-8000-000000000002",
    user_id: "u-demo-0001",
    artisan_id: aid(1),
    project_id: eid(1),
    artisan_name: "潘阿秀",
    project_name: "苗绣基础体验：绣一枚蝴蝶纹样",
    book_date: "2025-02-20",
    time_slot: "上午 09:00-12:00",
    contact_name: "演示用户",
    contact_phone: "13800000001",
    status: "已完成",
    created_at: "2025-02-12T14:30:00.000Z",
  },
  {
    id: "b0000003-0000-4000-8000-000000000003",
    user_id: "u-lin-0001",
    artisan_id: aid(3),
    project_id: eid(3),
    artisan_name: "杨桂彩",
    project_name: "扎染技法体验：捆扎与板蓝根染",
    book_date: "2025-03-22",
    time_slot: "下午 13:00-16:00",
    contact_name: "体验用户",
    contact_phone: "13800000002",
    status: "已确认",
    created_at: "2025-03-11T10:05:00.000Z",
  },
];

// ---------- 订单示例 ----------
export const MOCK_ORDERS: Order[] = [
  {
    id: "o0000001-0000-4000-8000-000000000001",
    user_id: "u-demo-0001",
    product_id: gid(1),
    product_name: "蝶恋花靛蓝蜡染围巾",
    order_number: "WZ2025031000012",
    price: 368,
    contact_name: "演示用户",
    contact_phone: "13800000001",
    address: "贵州省黔东南州凯里市示例路 1 号",
    status: "已发货",
    created_at: "2025-03-10T11:00:00.000Z",
  },
  {
    id: "o0000002-0000-4000-8000-000000000002",
    user_id: "u-lin-0001",
    product_id: gid(5),
    product_name: "喜鹊登梅扎染门帘",
    order_number: "WZ2025031500117",
    price: 246,
    contact_name: "体验用户",
    contact_phone: "13800000002",
    address: "云南省大理市示例路 3 号",
    status: "待发货",
    created_at: "2025-03-15T16:40:00.000Z",
  },
];

// ---------- AI 纹样（演示时由用户在 AI 工坊现场生成，种子留空） ----------
export const MOCK_AI_PATTERNS: AiPattern[] = [];
