/**
 * 调试串行执行配置问题
 */

import dotenv from "dotenv";
import WKAgent from "./src/index.js";

// 加载环境变量
dotenv.config();

async function testSerialDebug() {
  console.log("=== 并行和串行执行配置调试 ===\n");

  //串行单子agent
  // let agent = new WKAgent({
  //   isConcurrency: false,
  //   isHistoryAnalysis: false,
  //   forceJSON: true,
  //   maxSubTasks: 1,
  //   isDebug: true,
  // });

  //并行多子agent

  let agent = new WKAgent({
    isConcurrency: true,
    isHistoryAnalysis: false,
    forceJSON: true,
    maxSubTasks: 3,
    isDebug: false,
  });

  //串行多子agent
  /*==================================================
  let agent = new WKAgent({
    isConcurrency: false,
    isHistoryAnalysis: false,
    forceJSON: true,
    maxSubTasks: 3,
    isDebug: true,
    llm: {
      //baseURL:xxx,
      //model:xxx,
      apiKey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY,
      temperature: 0.7,
      maxTokens: 4000,
    },
  });
  ====================================================*/

  // 监听事件以确认执行模式
  agent.on("serial:start", (data) => {
    console.log(`\n执行模式确认: ${data.executionMode}`);
    console.log(`总任务数: ${data.totalTasks}`);
  });

  const finalContent = `
    萧景珩蜷缩在废弃观星台的角落，冷汗浸透了后背的衣衫。空气中弥漫着腐朽木梁的霉味，混合着后颈触须残留的黏液散发出的腥甜气息，令他胃部一阵阵痉挛。他死死咬住下唇，指甲深深掐入掌心，试图用肉体疼痛对抗那股翻涌而上的眩晕感。

'那些符文...'他强迫自己回忆青铜鼎上扭曲的纹路，每一道刻痕都在记忆里灼烧出青紫色的残影。月光透过残破的穹顶洒落，照亮他颤抖着在泥地上勾画的图案——正是太庙祭祀鼎腹部的三道连山纹。指尖泥土突然窜起幽蓝火苗，惊得他后撤半步，却见火中浮现出十年前皇帝南巡时的画面：御辇珠帘后，那双与如今如出一辙的、泛着青光的眼睛。

远处传来枯枝断裂的脆响。他贴着斑驳墙面缓缓站起，从木梁缝隙间窥见三个侍卫正以诡异姿态前行。他们的膝盖反向弯曲，每走一步都伴随'咯吱'虫鸣，月光下瞳孔收缩成细线，脖颈处隐约有蚯蚓状的凸起蠕动。

'噬梦蛊的傀儡。'这个认知令他锁骨处的旧伤骤然刺痛。当年父皇赐下的那碗鹿血羹里，想必也藏着同样的蛊虫幼体。他忽然想起姜昭及笄礼上碎裂的玉蝉——皇帝袖中抖落的粉末，分明与太庙香炉里的灰烬同源。

最前方的守卫突然180度扭转头颅，腐烂的牙龈暴露在月光下。萧景珩猛咬舌尖，血腥味炸开的瞬间将掌心按在刚画完的符文上。鲜血渗入泥土的刹那，三道金红纹路如锁链般缠上傀儡双脚，青光与血焰碰撞出令人牙酸的'滋滋'声。

借着这片刻喘息，他撞开虫蛀的雕花木窗跌入后院。腰间的龙纹玉佩突然发烫，那是姜昭上次入宫时偷偷塞给他的，此刻正与怀中铜钱产生奇妙共鸣。两件器物相触的瞬间，他看见无数碎片般的画面：夜阑君腰间的刽子手玉佩、父皇秘密接见的黑袍人、还有姜昭母亲临终前写在《太虚梦典》扉页的警告——所有线索突然串联成恐怖的闭环。

'原来所谓献祭...'他滚进芦苇丛时终于想通关键，'是用梦诏者的灵根喂养噬梦蛊！'身后传来梁柱坍塌的轰响，傀儡们正在拆毁整座观星台。他攥紧铜钱向河道跑去，月光下水面忽然浮现姜昭的倒影，少女唇间溢出的梦呓与十年前母妃临终前的呓语完全重合。

河对岸的官道上，数十盏青灯正呈扇形包抄而来。
  
  `;

  const summary = `
  萧景珩在逃离太庙后，藏身于废弃的观星台，强忍由触须黏液引发的眩晕与呕吐感。
  他回想起青铜鼎上的古老符文与蛊虫的异常反应，结合此前在太庙目睹的皇帝献祭场景，确信皇帝已被噬梦蛊寄生长达数十年。
  正当他梳理线索时，远处传来虫鸣般的异响——噬梦蛊已操控太庙守卫展开搜捕，守卫们双眼泛着青光，关节活动时发出诡异的鸣叫。
  萧景珩咬破舌尖以剧痛保持清醒，在闪避追兵时发现符文对蛊虫有镇压之效，遂用血在掌心临摹符文击退逼近的守卫。
  逃亡途中他意识到：皇帝背后的势力与姜昭遭遇的算计（呼应前置章节夜阑君的法印禁锢）可能存在关联。
  场景重点刻画：1.黏液残留引发的幻觉与观星台腐朽木梁的气味交织；
  2.守卫被操控后肢体扭曲的骇人姿态；3.血符文与青光碰撞时的能量波动。正文需强化：1.萧景珩推理的逻辑链条（衔接前置章节血色潜行的发现）；2.符文镇压效果与姜昭铜钱符文的潜在呼应；3.为后续揭露皇帝与夜阑君的勾结埋线（参见暗流对峙章节）。
  
  `;

  /** TASK1，分析
   * 返回结果所写即所得{"consistencyLevel": 8, "analysis": "具体分析说明"}
   */
  const result = await agent.execute(`
    任务：评估小说正文与summary内容的一致性等级
    
    正文：${finalContent}
    summary：${summary}
    
    评估标准：
    1. 情节要素覆盖程度
    2. 细节描写对应关系  
    3. 逻辑链条完整性
    
    返回格式：{"consistencyLevel": 8, "analysis": "具体分析说明"}
`);
  //在json里
  console.log("=== 完整结果 ===", result.json);

  /** TASK2:基于分析结果生成 */
  const newChapter = await agent.execute(`
    任务：基于summary要求重构小说正文内容
    
    当前一致性等级：${result.json?.consistencyLevel || 8}/10分
    原始正文：${finalContent}
    目标summary：${summary}
    
    重构要求：
    1. 强化感官细节描写（黏液幻觉、腐朽气味、肢体扭曲）
    2. 完善推理逻辑链条（衔接血色潜行章节）
    3. 加强符文效果与姜昭铜钱符文的呼应关系
    4. 为皇帝与夜阑君勾结埋线
    5. 保持原有文学风格和情节主线
    6. 输出完整的重构后正文（约3000字）
    
    返回格式要求：JSON对象，包含"chapter"字段存放重构后的完整正文
    示例：{"chapter": "重构后的小说正文内容..."}
    `);

  console.log("=== 重构结果 ===");
  console.log("JSON数据:", newChapter.json);
  if (newChapter.json?.chapter) {
    console.log(
      "重构后正文预览:",
      newChapter.json.chapter.substring(0, 200) + "..."
    );
  }
}

// 运行调试测试
testSerialDebug().catch(console.error);
