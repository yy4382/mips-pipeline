#set text(font: ((name: "PingFang SC", covers: "latin-in-cjk"), "SF Pro"), lang: "zh")

#show heading.where(level: 2): set block(spacing: 1.5em)

#set figure(numbering: none)

#set heading(numbering: "1.")

#show link: underline

#set heading(
  numbering: (..nums) => {
    // We want the positional arguments
    // from `nums`.
    // `numbers` is now an array of ints
    // e.g. a level one heading `= ...`  could be (1,)
    // e.g. a level two heading `== ...` could be (2, 1)
    // e.g. a level three heading `=== ...` could be (1, 0, 2)
    let numbers = nums.pos()
    // Top level (level 1) headings will have a single
    // int like (1,), as mentioned above. So we check
    // if the array's length is 1 for level one headings.
    if numbers.len() == 1 {
      none
    } else if numbers.len() >= 4 {
      none
    } else {
      // Everything else
      numbering("1.1", ..numbers)
    }
  },
)

#show raw.where(block: false): box.with(
  fill: luma(240),
  inset: (x: 3pt, y: 0pt),
  outset: (y: 3pt),
  radius: 2pt,
)

// #set raw(syntaxes: "riscv-asm.sublime-syntax")

= 体系结构上机2

== 实验内容

#set enum(numbering: "1.A.")
+ 编写流水线模拟器，应该至少实现以下功能：

  + 能够模拟 MIPS 的 5 段流水线，以课堂讲授为参考；

  + 支持图形交互或者命令交互；
  + 支持单步执行（一次一个时钟周期）、执行到断点、执行到程序结束；
  + 支持流水线各个段、寄存器状态的查看；
  + 提供是否使用定向路径的功能选项；
  + 提供程序执行后的性能统计分析；
  + 按照 MIPS 语法，至少支持 load、store、add、beqz 操作；
  + 要执行的程序可以直接输入，或通过文件载入的方式运行；
  + 可以使用你喜欢的任何语言来实现；
  + 可参考上机实验 I 中的两个模拟器中实现的功能；


+ 使用在(1)中 G 提到的指令，设计至少 3 种不同的代码组合，实现以下功能的演示：
  + 没有任何冲突的流水线场景；

  + 有至少一次的 RAW 冲突；
  + 有至少一次的分支跳转；
  + 使用课堂讲授的内容，对上述每一种场景进行分析


#set enum(numbering: "1.")

== 模拟器设计思想

我的模拟器采用 Javascript (TypeScript) 编写。选择 JS 的主要原因是为了方便制作网页前端进行演示。

整体来看，模拟器分为模拟器本身和展示前端两部分。

=== 模拟器

模拟器负责汇编 MIPS 指令，模拟硬件和模拟执行指令。

==== 汇编器的简化实现

本次实验实现了一个简单的命令解析器，不支持伪指令 (`.text`, `.data` 等)，但支持除了无符号数运算之外的大部分普通指令，包括：

- 算数类 `add, sub, addi, and, andi, or, ori, xor, xori, sll, slli, srl, srli, sra, srai`
- 内存类 `lw, sw`
- 分支类 `beq, bne, blt, bgt, ble, bge`
- pseudo-instruction `li, nop, beqz, bnez, mv, j`

#quote(block: true)[
  MIPS 中的 blt 等指令是 pseudo-instruction，实际上是用 `slt` 和 `bne` 实现的。为了简化实现，这里采用了类似 RISC-V 的实现方式，直接支持 `blt` 等指令。
]

#quote(block: true)[
  伪指令的实现方式：
  - `li` 使用 `addi`
  - `nop` 使用 `add $0, $0, $0`
  - `beqz $t1, label` 使用 `beq $t1, $0, label`
  - `bnez $t1, label` 使用 `bne $t1, $0, label`
  - `mv $t1, $t2` 使用 `addi $t1, $t2, 0`
  - `j label` 使用 `beq $0, $0, label`（不是 MIPS 标准，但是本项目中由于下面会提到的 iMem 简化实现导致行为是一致的）
]

对于跳转标签，可以和指令写在一行，也可以单独写在一行。

支持 `$0` 这样的寄存器表示法，也支持使用 `$t0` 这样的寄存器别名。

==== iMem, dMem 和 Register-file 的简化实现

出于方便考虑，我对简化了指令和内存的编号访问方式。将一个寄存器的长度设为一个“单位”；iMem 和 dMem 都实现为“单位”的数组，按“单位”来访问。

例如，
- `lw $1, 0($0)` 代表将 dMem[0] 的值加载到寄存器 `$1` 中；
- `lw $1, 1($0)` 代表将 dMem[1] 的值加载到寄存器 `$1` 中；
- PC 为 0 时，取 iMem[0] 指令；
- PC 为 1 时，取 iMem[1] 指令。

这样的简化主要是因为 JavaScript 中所有数字都是 IEEE 754 双精度浮点数，无法直接表示 32 位整数，这样将一个双精度浮点是当作一个“单位”对于「模拟流水线」的目标来说差异并不太大，但是在实现上会简单很多。

汇编器和硬件的实现具体使用的标准写在了 #link("https://github.com/yy4382/mips-pipeline/blob/main/src/lib/simulator/spec.md")[src/lib/simulator/spec.md] 中。

==== 流水线模拟

模拟了一个标准的 MIPS 5 段流水线，IF, ID, EX, MEM 和 WB，存储了每个阶段之间的流水线寄存器的值。

支持在硬件层面（而不是依赖汇编器添加 NOP）实现 data hazard 自动插入 STALL。

分支时，总是预测为不跳转，如果预测失败，则 flush 流水线。

支持启用和不启用定向路径。

同时，模拟器提供了大量的回调和可注册的监听器，可以在模拟器内部状态改变时触发前端的更新。

=== 前端

前端是一个 React 项目，可以直接在 https://mips-pipeline-simulator.vercel.app 上体验运行。

支持的功能：
- 单步执行
- 执行到结束
- 执行到断点
- 直接输入指令
- 载入示例指令
- 修改内存中的值

显示的内容：
- *流水线时空图*
- 指令列表和它们正处在哪个流水线阶段
- 流水线寄存器的值
- 寄存器的值
- 内存的值（可以修改）
- 性能统计信息
- 出现过的 Data hazard 和 branch prediction failure

前端主要通过各种回调函数来从模拟器监听获取数据。

在一些较久版本的浏览器中（比如我测试的 Edge 130），寄存器和内存中值的更新有可能不会立即反映在 UI 上，可能需要手动点一点它们两个组件来触发更新（其他显示组件工作的都很好），在更新的 Edge 135 和 Chrome 135 中一切正常。

== 设计特色

最大的特色在于方便直观的前端展示；基本实现了第一次实验中 MIPSsim 模拟器在显示方面的功能。

在流水线模拟器中，尽量模仿了实际 CPU 的设计，比如在流水线中，使用了命令翻译而来的控制信号来控制每个阶段的运行，而不是在每个阶段里对各种指令类型 if/else 来处理。在开发方面，也是为了方便重构，添加了大量测试，最终在模拟器模块中测试的覆盖率达到了 84%。（运行 `pnpm vitest --coverage`）

在前端方面，我设计了一个直观易用的展示界面，同时得益于 Web 生态，美观程度也好于其他大部分模拟器。同时，网页的另一个好处是可以随处直接运行，不需要下载或编译，打开浏览器即可直接运行。

== 测试代码分析

运行结果在下一个章节。

测试 1 是网页打开后的默认指令；测试 2、测试 5 和测试 7 的代码可以在网页上指令输入框下方的快速选择中直接载入。

=== 1. 简单的、没有任何流水线冲突的代码

```asm
lw $t1, 0($0)
lw $t2, 1($0)
nop
nop
add $t3, $t1, $t2
nop
nop
sw $t3, 2($0)
```

由于在硬件实现上决定了 `$0` 永远是 0 且无法写入，该段代码没有任何冲突。

==== 运行

运行前设置好内存
#align(center)[
  #image("no-raw-pre-run-set-mem.png", width: 30%)
]

直接运行到结束（Run to End 按钮）

#figure(
  image("no-raw-chart.png", height: 6cm),
  caption: "流水线时空图",
)

#figure(
  grid(
    columns: 2,
    gutter: 1em,
    image("no-raw-mem-reg.png", height: 5cm), image("no-raw-statistics.png", height: 5cm),
  ),
  caption: "寄存器、内存的值和统计信息",
)

可以看到最后的 `$t3` 和内存 2 中的值都是 3，符合预期。
统计信息中可以看出，一共使用12个时钟周期运行了8条指令，没有发生任何冲突。

=== 2. RAW 冲突

```asm
lw $t1, 0($0)
lw $t2, 1($0)
add $t3, $t1, $t2
sw $t3, 2($0)
```

不采用定向路径时，第三条指令(`index = 2`)会停顿两个周期，第四条(`index = 3`)也会停顿两个周期。（直到 WB 阶段完成后才能执行下一条的 ID 阶段）。执行结束后，共停顿 4 个周期。

如果采用定向路径，第三条会停顿一个周期（直到 MEM 段结束时数据才可用），第四条不会停顿（上一条的 EX 直接输入下一条的 EX）。执行结束后，共停顿 1 个周期，发生两次 forwarding。

==== 运行（不使用定向路径）

在页面最底部中选择 RAW 示例载入。

和上一个测试一样，在运行前设置好内存。

之后逐步执行。

运行到第四个周期时，`add $t3, $t1, $t2` 在 ID 阶段检测到了 RAW 冲突，因此插入了停顿。

#figure(
  image("image.png"),
  caption: "此时的流水线时空图",
)

#figure(
  image("CleanShot_2025-04-30_11.15.30.png"),
  caption: "此时的指令所处状态和流水线寄存器值",
)

#figure(
  align(center, image("CleanShot_2025-04-30_11.15.38.png", height: 40%)),
  caption: "此时的统计信息",
)

可以发现，前两个阶段重新运行了上一个时钟周期的指令，而 ID/EX 阶段的流水线寄存器中的指令被替换成了 NOP。

类似的，在第5周期，`add $t3, $t1, $t2` 需要的数据依旧没有准备好，所以再次停顿。

之后在 6、7 周期中，`sw` 指令也会插入两条停顿。

最后运行结束后的时空图、内存、寄存器和统计信息如下：

#figure(
  image("CleanShot_2025-04-30_11.22.16.png"),
  caption: "流水线时空图",
)

#figure(
  grid(
    columns: 2,
    gutter: 1em,
    image("CleanShot_2025-04-30_11.22.27.png", height: 6cm), image("CleanShot_2025-04-30_11.22.40.png", height: 6cm),
  ),
  caption: "寄存器、内存的值和统计信息",
)


==== 运行（使用定向路径）

在页面最底部中选择 RAW 示例载入，并且打开 Forwarding 开关，设置好内存。

运行到第4周期后，由于 load 指令的值需要在 MEM 阶段结束后才能使用，所以即使开启了定向也会停顿一个周期。

// #align(center)[
//   #image("CleanShot_2025-04-30_11.26.51-1.png", height: 7cm)
//   #image("CleanShot_2025-04-30_11.28.03.png", height: 7cm)
// ]

#align(center)[
  #grid(
    columns: 2,
    align: horizon,
    image("CleanShot_2025-04-30_11.26.51-1.png", height: 5cm), image("CleanShot_2025-04-30_11.28.03.png", height: 6cm),
  )
]
第5周期，虽然还未写入，但是数据已经可用，所以定向发生，不再停顿。

#align(center)[
  #grid(
    columns: 2,
    align: horizon,
    image("CleanShot_2025-04-30_11.28.58.png", height: 4cm), image("CleanShot_2025-04-30_11.29.06.png", height: 6cm),
  )
]

同样，在第6周期，`sw` 会直接使用定向而来的 `$t3` 的值。

运行结束后的时空图、内存、寄存器和统计信息如下：

#figure(
  image("CleanShot_2025-04-30_11.31.20.png"),
  caption: "流水线时空图",
)

#figure(
  grid(
    columns: 2,
    gutter: 1em,
    image("CleanShot_2025-04-30_11.31.28.png", height: 5cm), image("CleanShot_2025-04-30_11.31.35.png", height: 5cm),
  ),
  caption: "寄存器、内存的值和统计信息",
)

=== 3. 分支跳转：分支所用寄存器存在 RAW 冲突

如果正确实现了 RAW 和 branch 的冲突检测，那么这不应该是一个需要特殊处理的情况。

```asm
li $t1, 1
li $t2, 2
lw $t3, 0($0)
beqz $t3, target
add $t4, $t1, $t2
add $t4, $t1, $t2
target:
add $t5, $t1, $t2
sw $t4, 1($0)
sw $t5, 2($0)
```

按照在内存 0 中值的不同，会有跳转和不跳转两种情况。

==== 运行（不跳转）

在页面最底部中选择 Branch 示例载入，并且设置好内存。

由于总是预测分支失败，所以没有出现 Control Hazard。

#align(center)[
  #grid(
    columns: 2,
    align: horizon,
    image("CleanShot_2025-04-30_11.57.17.png", height: 4cm), image("CleanShot_2025-04-30_11.57.30.png", height: 6cm),
  )
]

// #image("CleanShot_2025-04-30_11.57.17.png")

从统计数据中可以看出只有 data hazard。

// #figure(
//   image("CleanShot_2025-04-30_11.57.30.png", height: 7cm),
//   caption: "统计信息",
// )


==== 运行（跳转）

在页面最底部中选择 Branch 示例载入，并且设置好内存。
在内存 0 中设置为 0。

运行结束后的时空图：

#align(center)[
  #grid(
    columns: 2,
    align: horizon,
    figure(
      image("CleanShot_2025-04-30_11.55.22.png"),
      caption: "流水线时空图",
    ),
    figure(
      image("CleanShot_2025-04-30_11.57.56.png", height: 7cm),
      caption: "统计信息",
    ),
  )
]

// #figure(
//   image("CleanShot_2025-04-30_11.55.22.png"),
//   caption: "流水线时空图",
// )

// #figure(
//   image("CleanShot_2025-04-30_11.57.56.png", height: 7cm),
//   caption: "统计信息",
// )

=== 4. 数据定向时需要的寄存器在 EX/MEM 和 MEM/WB 阶段的指令都将被写入

```asm
li $t1, 1
addi $t1, $t1, 1
addi $t1, $t1, 2
addi $t1, $t1, 3
```

在最后一步中，`$1` 的值需要从之前的指令中定向而来。但是前一个指令（现在在 MEM 阶段）和前前一个指令（现在在 WB 阶段）都将 `$1` 的值写入到 `$1` 中。在这种情形中，需要从 MEM 阶段的指令中读取 `$1` 的值，而不是从 WB 阶段的指令中读取 `$1` 的值，才能获取正确的结果。

==== 运行

运行结束后寄存器值：
#figure(
  image("CleanShot_2025-04-30_11.59.16.png", height: 5cm),
  caption: "寄存器值",
)
可以看到 `$t1` 的值是 7，符合预期。

=== 5. 斐波那契数列求值

从内存 0 位置中读取一个 n，计算斐波那契数列的第 n 项，存储到内存 1 位置中。

如果 n <= 0，则储存 -1。

```asm
lw $t1, 0($0)
ble $t1, $0, invalid_input
li $t2, 0
li $t3, 1
beq $t1, $t3, return_0 # if $t1 == 1, return_0
li $t4, 2
beq $t1, $t4, return_1 # if $t1 == 2, return_1
addi $t1, $t1, -2 # because the first two fibonacci numbers are 0 and 1
loop:
  beqz $t1,
  if (n == 2) return 1;
  n -= 2;
  int a = 0, b = 1;
  while (n--) {
    int c = a + b;
    a = b;
    b = c;
  }
  return b;
}
```

==== 运行

在页面最底部中选择 Fibonacci 示例载入。

设置参数为 0（不合法参数）输出 -1，符合预期。
#align(center)[
  #image("image-1.png", height: 80%)
]

设置参数为 2，输出 1，符合预期。
#align(center)[
  #image("image-2.png", height: 80%)
]

设置参数为 4，输出 2，符合预期。
#align(center)[
  #image("image-3.png", height: 80%)
]

== 实验感悟

在本次实验中，我有以下几个感悟：

+ 流水线中数据冲突的处理比我预想中的要简单一些；我原本以为需要一个有状态的硬件结构监控曾经和现在的指令来探测和处理冲突，实际上发现这个结构不需要自带状态，可以直接从后面的阶段中读取指令和数据；同时，我一开始没有搞清楚“插入停顿”具体是怎么实现的，在实现过程中发现只需要将指令替换为 NOP 即可，控制冲突也是类似的情况。

+ 从上一点中，我还感悟到课程书面上的学习和实际实现的差距；只有实际上手了，才能真正理解。

+ 模仿硬件的实现，而非借助高级语言的特性“开外挂”反而让代码更加简洁、更加健壮。我最初的实现是在流水线中根据命令的不同使用大量的 if/else 处理不同的指令，但是发现这样会让我的代码不仅冗长，而且在添加新指令时需要修改大量内容，很容易出错；后来我模仿硬件的实现（其实一开始就该这样）将指令抽象为读取写入的寄存器和控制信号，反而让流水线的实现与指令本身无关了，代码也变得简洁了。

一些与流水线关系不大，但是在本项目编写过程中得到的工程上的感悟：

+ 保持各个模块之间的独立性。比如流水线不应该和指令耦合，而只应该和指令产生的控制信号交互；这样可以让流水线的实现和指令的实现分开，方便重构和扩展。

+ 足够的测试是重构时的信心来源。实现过程中，我的指令解析模块完全重构了三次，每次重构时都能有信心保证原来的功能不变，都是因为有足够的测试覆盖率。

+ 流水线实现的“可观测性”很重要。通过给流水线的 step 函数添加回调，让外部系统（本项目中是 Web 前端）可以观察到流水线的状态变化，方便演示。
