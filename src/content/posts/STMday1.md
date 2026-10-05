---
title: "STMday1"
published: 2026-08-18T20:45:23+08:00
description: "让某个 GPIO 引脚按程序输出高/低电平；引脚身份 = 端口字母 + 引脚号（如 PA0）； 操作分四步：开端口时钟 → 填配置单（结构体）→ HALGPIOInit 生效 → "
image: ''
tags: ["STM32", "嵌入式", "学习笔记"]
category: "技术"
draft: false
lang: ''
---
## 以下内容由所记录的知识库整理而来




***




### STM32 点灯：GPIO 输出原理与 HAL 操作


让某个 GPIO 引脚按程序输出高/低电平；引脚身份 = 端口字母 + 引脚号（如 PA0）；
操作分四步：开端口时钟 → 填配置单（结构体）→ HAL_GPIO_Init 生效 → WritePin 写电平。


【核心内容/工作流程】
1. 引脚身份：端口（GPIOA~GPIOK）+ 引脚号（GPIO_PIN_0~15），如 PA0 = `GPIOA` + `GPIO_PIN_0`
2. 开时钟：`__HAL_RCC_GPIOA_CLK_ENABLE()`——外设默认断电，必须先"合闸"，否则配置无效甚至卡死；端口字母与宏对应（GPIOA→GPIOA_CLK，GPIOB→GPIOB_CLK...）
3. 配置单模式（结构体）：
   ```c
   GPIO_InitTypeDef gpio = {0};            // 新建空白配置单并清零
   gpio.Pin   = GPIO_PIN_0;                // 引脚号
   gpio.Mode  = GPIO_MODE_OUTPUT_PP;       // 推挽输出
   gpio.Speed = GPIO_SPEED_FREQ_HIGH;      // 高速
   gpio.Pull  = GPIO_NOPULL;               // 无上下拉
   HAL_GPIO_Init(GPIOA, &gpio);            // 端口 + 配置单地址，生效
   ```
4. 写电平：`HAL_GPIO_WritePin(GPIOA, GPIO_PIN_0, GPIO_PIN_SET/RESET)`——SET=高电平(3.3V)亮，RESET=低电平(0V)灭
5. 闪烁主循环：`while(1) { SET; HAL_Delay(500); RESET; HAL_Delay(500); }`——死循环 + 延时


【踩坑】 
1. 忘开时钟（80% 新手的第一个 bug）
2. 端口与引脚不配对：`Pin` 填 `GPIO_PIN_0` 但 Init 端口写 `GPIOC`
3. 漏填配置单字段、漏写 `&`




***




### STM32 时钟系统（硬件原理：RCC / HSI / HSE / PLL / 分频）




【核心定义】STM32 时钟分两个层次：全局时钟（RCC 模块，决定芯片主频与总线频率）和外设时钟开关（决定某外设是否通电）；全局时钟配置先于外设开关——先让水厂供水（总水管），住户（外设）才有水可用。


【核心内容/工作流程】
1. 时钟源：HSI（内部 16MHz 振荡器，免外部晶振，精度一般）、HSE（外部晶振，需 PLL 倍频）、PLL（锁相环倍频器，如 16MHz×10.5=168MHz）
2. 全局时钟链：SYSCLK（CPU 主频）→ HCLK（AHB 总线）→ PCLK1（低速外设总线）/ PCLK2（高速外设总线），各级可配置分频
3. 外设时钟开关：`__HAL_RCC_GPIOx_CLK_ENABLE()` 系列宏，逐个外设独立"合闸"
4. 顺序铁律：先 SystemClock_Config()（全局时钟），再开外设时钟，再配置外设
5. v0.1 用 HSI 16MHz 全链 1:1：最小系统板常无外部晶振，HSI 最省事；v0.3 上 I2S 音频时须切 HSE+PLL 精确时钟（I2S 对时钟精度敏感）




***




### SystemClock_Config() 代码解析（软件写法）


【核心定义】SystemClock_Config() 是 HAL 规定的全局时钟配置函数，通过两张"配置单"结构体完成：osc 单（选时钟源/开 PLL）交给 HAL_RCC_OscConfig，clk 单（主频来源/总线分频）交给 HAL_RCC_ClockConfig；写法固定，v0.1 是 HSI 16MHz 的最简形态。


【核心内容/工作流程】
1. 完整代码（v0.1 版，HSI 16MHz）：
   ```c
   static void SystemClock_Config(void) {
     RCC_OscInitTypeDef osc = {0};        // 振荡器配置单
     RCC_ClkInitTypeDef clk = {0};        // 时钟分配配置单
     __HAL_RCC_PWR_CLK_ENABLE();          // 先开电源管理模块
     __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);  // 电压最高档
     osc.OscillatorType = RCC_OSCILLATORTYPE_HSI;   // 时钟源选 HSI
     osc.HSIState = RCC_HSI_ON;           // 打开 HSI
     osc.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;  // 出厂校准值
     osc.PLL.PLLState = RCC_PLL_NONE;     // 不用 PLL（v0.1 无需高频）
     HAL_RCC_OscConfig(&osc);             // 执行 osc 单
     clk.ClockType = RCC_CLOCKTYPE_SYSCLK | RCC_CLOCKTYPE_HCLK |
                     RCC_CLOCKTYPE_PCLK1 | RCC_CLOCKTYPE_PCLK2;  // 配 4 类时钟
     clk.SYSCLKSource = RCC_SYSCLKSOURCE_HSI;   // 主频水源
     clk.AHBCLKDivider  = RCC_SYSCLK_DIV1;      // AHB 1:1
     clk.APB1CLKDivider = RCC_HCLK_DIV1;        // APB1 1:1
     clk.APB2CLKDivider = RCC_HCLK_DIV1;        // APB2 1:1
     HAL_RCC_ClockConfig(&clk, FLASH_LATENCY_0);  // 执行 clk 单（低主频 0 等待）
   }
   ```
2. 两个结构体各管一摊：osc 管"用哪个时钟源、倍不倍频"，clk 管"主频从哪来、分给各总线多少"
3. `static` 修饰：函数仅本文件使用，防止跨文件重名，嵌入式惯例
4. 为什么这么写：ST 官方 HAL API 就是"填单→提交"模式；不能省略（HAL 不知道时钟方案就无法工作）
5. 后续演进：v0.3 配 168MHz 时改 osc.PLL 为倍频配置、clk 加分频系数（APB1÷4=42MHz 等），模板不变只改值


【适用场景】
- 每个 STM32 工程的标准开头
- 理解"配置单+提交"的 HAL 编程模式（GPIO/串口/I2S 全部同构）
【常见误区】
1. 忘记 `{0}` 清零导致配置单含垃圾值
2. 想省略该函数——HAL 库要求必须提供
3. 把 static 理解为"静态变量"——此处是"文件内私有函数"




***




### SysTick 与中断基础（HAL_Delay 的时间心脏）


【核心定义】SysTick 是芯片内置的"系统滴答定时器"，HAL 将其配置为每 1ms 产生一次中断；中断 = 主程序执行中"被闹钟插队"去执行处理函数再回来；HAL_Delay 依赖 SysTick 中断更新全局时间计数，缺 SysTick_Handler 处理函数则计数不动、延时卡死。


【核心内容/工作流程】
1. 中断模型（闹钟插队）：主程序顺序执行，每 1ms SysTick 闹钟响 → CPU 暂停 → 执行 SysTick_Handler → 返回主程序继续
2. 必备处理函数（每个 HAL 工程必须有）：
   ```c
   void SysTick_Handler(void) {
       HAL_IncTick();   // 全局时间计数 uwTick +1
   }
   ```
3. HAL_Delay(ms) 原理：记录当前 uwTick → 空转等待 `uwTick - 记录 >= ms`；无 SysTick_Handler 则 uwTick 恒 0，条件永假 → 死等卡死
4. 卡死症状：引脚停在刚写出的电平（如恒 3V，万用表量占空比 0）
5. 事件驱动思维：主程序不是唯一执行者，中断可随时插队；合成器音频输出（DMA/I2S 中断）同此模型


【适用场景】
- 任何用 HAL_Delay/超时功能的工程（必带 SysTick_Handler）
- 理解后续定时器中断、DMA 中断、音频中断的统一模型


【常见误区】
1. 以为 HAL 库自带 SysTick_Handler——实际必须用户提供，HAL 只使能中断不实现处理
2. 中断是"顺序执行的一步"——它是后台插队，不属于主流程顺序


【踩坑实录】
- 2026-08-18：点灯程序烧录后灯恒亮不闪，万用表量 PA0 恒 3.3V 占空比 0——定位为缺 SysTick_Handler，程序卡死在 HAL_Delay(500)。补上后正常闪烁。排障手段：万用表直流电压档测引脚电平跳变，是最客观的"程序是否在跑"判据

