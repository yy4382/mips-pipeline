#set text(font: "Sarasa Gothic SC", lang: "zh")

#show heading.where(level: 2): set block(spacing: 1.5em)

#show link: underline

#show raw.where(block: false): box.with(
  fill: luma(240),
  inset: (x: 3pt, y: 0pt),
  outset: (y: 3pt),
  radius: 2pt,
)

#import "@preview/subpar:0.2.2"

#set heading(numbering: "1.")

#text(20pt)[
  *指令动态调度性能分析*
]

实现了一个 Tomasulo 算法的模拟器。介绍了它的设计思想和特色，并且进行了演示。

#outline(indent: 1.2em)

= 实验内容

实现一个 Tomasulo 算法的模拟器，支持以下功能：

+ 能够模拟 Tomasulo 算法的执行过程，以课堂讲授为参考；
+ 支持图形交互或者命令交互；
+ 支持单步执行（一次一个时钟周期） 、一次多个周期，执行到程序结束；
+ 支持保留站、指令状态表、寄存器状态表等内容的查看（支持对已执行过的时钟周期的上述内容回看）；
+ 提供程序执行后的性能统计分析；
+ 按照 MIPS 语法，至少支持 load、store、add.d、sub.d、mul.d、div.d操作；
+ 要执行的程序可以直接输入，或通过文件载入的方式运行；
+ 可以使用你喜欢的任何语言

= 模拟器设计思想与特色

与上次上机一样，我的模拟器采用 Javascript (TypeScript) 编写。选择 JS 的主要原因是为了方便制作网页前端进行演示，同时可以和上次的上机作业共享部分代码。

整体来看，模拟器分为模拟器本身和展示前端两部分。

== 汇编器

实现了一个简单的汇编器，支持 `L.D`, `S.D`, `ADD.D`, `SUB.D`, `MUL.D`, `DIV.D` 6 个指令，浮点寄存器用 `$f0` 到 `$f15` 表示（整数寄存器可以用 `$0` 到 `$31` 表示，也可以使用 MIPS 中对 32 个整数寄存器的别名，如 `$t0` 到 `$t9` 等）。

示例：
```asm
L.D $f0, 0($0)
S.D $f0, 0($0)
ADD.D $f0, $f0, $f0
SUB.D $f0, $f0, $f0
MUL.D $f0, $f0, $f0
DIV.D $f0, $f0, $f0
```

== 模拟器

实现了一个完整的 Tomasulo 算法模拟器。

DMem 的实现做了简化，每个索引位置存储一个 64 位浮点数，而不是一个字节。

合理地处理了 CDB 可用性问题（多指令同时执行结束，@CDB-available-problem）、load/store 队列（@load-store-queue）等边缘情况。

支持查看总时钟周期数、已指令指令等性能指标。

可以调整保留站的多少和每种指令的执行时间（虽然前端上没写调整它们的控件）。

== 前端

前端是一个 React 项目，和上次上机在同一个项目中，可以在 https://mips-pipeline-simulator.vercel.app/tomasulo 上体验运行。

支持的操作：
- 单步执行
- 执行到结束
- 执行到断点
- 直接输入指令
- 载入示例指令（页面最下方）
- 修改内存中的值

显示的内容：

- 指令执行状态表
- 保留站状态表（可回看已执行过的时钟周期）
- 寄存器状态表 Qi（可回看已执行过的时钟周期）
- 性能统计信息
- 寄存器的值
- 内存的值

@full-show 是前端页面完整展示。

在一些较久版本的浏览器中（比如我测试的 Edge 130），寄存器和内存中值的更新有可能不会立即反映在 UI 上，可能需要手动点击它们两个组件来触发更新（其他显示组件工作的都很好），在更新的 Edge 135 和 Chrome 135 中一切正常。

#pagebreak()

= 实验演示

展示时的模拟器被设置为使用 3 个 Load/Store 队列，3 个 Add 保留站，2 个 Mul 保留站，和 16 个浮点寄存器。Load / Store 需要 2 个时钟周期，Add/Sub 需要 2 个时钟周期，Mul 需要 10 个时钟周期，Div 需要 40 个时钟周期。


== 无任何冲突

```asm
L.D $f0, 0($0)
ADD.D $f1, $f2, $f2
S.D $f3, 0($1)
```

从 @no-conflict 可以看到，执行过程中没有发生任何冲突，所有指令都按照预期顺序执行。

#subpar.grid(
  figure(
    image("1.1.png"),
    caption: "指令时间图",
  ),
  figure(
    grid(
      image("1.2.1.png"),
      image("1.2.2.png"),
      image("1.2.3.png"),
      image("1.2.4.png"),
      image("1.2.5.png"),
      image("1.2.6.png"),
      columns: 3,
      gutter: 1em,
    ),
    caption: "保留站和寄存器状态表（最后一个周期执行结束后为全空，因此省略）",
  ),
  caption: "无任何冲突的执行过程",
  label: <no-conflict>,
)

== RAW 冲突

```asm
L.D $f0, 0($0)
L.D $f2, 1($0)
ADD.D $f4, $f0, $f2
S.D $f4, 0($0)
```

从 @raw-conflict 可以看到，执行过程中发生了 RAW 冲突。

+ ADD.D 指令由于需要第二条 L.D 指令的写回值，因此等待到时钟周期 6（L.D 写回之后 1 周期）才开始执行。
+ S.D 指令需要等待 ADD.D 指令写回之后才能写回，即使它的执行（计算地址）在第 6 周期就已经结束，还是需要等到第 9 周期才能写回。
+ 同时我们发现，S.D 的执行在 ADD.D 之前（虽然写回在 ADD.D 之后），即使 ADD.D 本身在 S.D 之前。这体现了 Tomasulo 算法乱序执行的特性。

#subpar.grid(
  figure(
    image("2.1.png"),
    caption: "指令时间图",
  ),
  figure(
    grid(
      image("2.2.1.png"),
      image("2.2.2.png"),
      image("2.2.3.png"),
      image("2.2.4.png"),
      image("2.2.5.png"),
      image("2.2.6.png"),
      image("2.2.7.png"),
      image("2.2.8.png"),
      image("2.2.9.png"),
      columns: 3,
      gutter: 0.5em,
    ),
  ),
  caption: "RAW 冲突的执行过程",
  label: <raw-conflict>,
)

== WAR 冲突

```asm
MUL.D $f4, $f1, $f1
ADD.D $f0, $f2, $f4
ADD.D $f2, $f3, $f6
```

从 @war-conflict 可以看到，执行过程中理应发生 WAR 冲突，但是 Tomasulo 的算法设计可以正确处理。

- 第二条指令需要读入第三条指令的写入值，同时由于第一条指令的存在，使得第二条指令的执行晚于第三条指令（第一条与第二条有 RAW，延迟了第二条的执行），产生了 WAR 冲突。
- 但是，Tomasulo 算法设计中，第二条指令的 `$f2` 在被 issue 时就已经被写进保留站中，通过这种设计避免了 WAR 冲突。

#figure(
  image("3.1.png"),
  caption: "WAR 冲突 指令时间图",
)<war-conflict>

== PPT 上的示例程序

在 PPT 上逐步演示的示例程序。本模拟器可以 1:1 复现 PPT 上的整个执行过程，最后使用了 57 个时钟周期，和 PPT 上一致。

#figure(
  image("4.1.png"),
  caption: "PPT 上的示例程序 指令时间图",
)

== CDB 可用性问题 <CDB-available-problem>

```asm
MUL.D $f1, $f2, $f3
ADD.D $f4, $f1, $f5
SUB.D $f6, $f1, $f7
```

从 @CDB-available-problem-fig 中可以发现，第二条和第三条都在第 14 周期执行结束。然而，由于 CDB 每个周期只能传递一条数据，因此它们不能在同一个周期内写回。

本模拟器也将这种边缘情况纳入了考虑，ADD 指令在 15 周期写回，而 SUB 指令则等待了一个周期，直到 16 周期才写回。

#figure(
  image("5.1.png"),
  caption: "CDB 可用性问题",
) <CDB-available-problem-fig>

== Load/Store 队列 <load-store-queue>

```asm
S.D $f0, 0($0)
L.D $f2, 0($1)
```

在这个示例中，S.D 指令和 L.D 指令间并没有依赖关系，但是由于 Load/Store 需要当自身是缓冲区头部时才能进入执行阶段，因此 L.D 指令需要等待 S.D 指令写回后才能进入执行阶段。

从 @load-store-queue-fig 可以看到，虽然 L.D 指令在第二周期已经流出，但是它直到第 4 周期 S.D 写结果之后才能在第 5 周期进入执行阶段。

#figure(
  image("6.1.png"),
  caption: "Load/Store 队列",
) <load-store-queue-fig>

== 更多

在代码中的 `src/lib/simulator/tomasulo/tomasulo.test.ts` 中，还包含了更多测试用例，覆盖了更多边缘情况，比如 Load 和算数指令之前的 CDB 可用性问题（而非上文演示的算数指令和算数指令之间）等。

= 实验感悟

通过本次实现 Tomasulo 算法模拟器的实验，我对指令级并行以及乱序执行等概念有了更为深刻和直观的理解。在理论学习阶段，这些概念往往显得较为抽象，但通过亲手设计和编码模拟器的过程，我能够清晰地观察到指令如何在保留站中等待操作数、如何通过 CDB 获取结果、以及寄存器重命名消除数据冲突。

在设计与实现过程中，我发现最具挑战性的部分有两个：

+ 真正的 CPU 在运行时各个部件时同时运作的，而代码模拟对于三个阶段总有先后。如果正着执行，在同一个周期内先流出了指令，那接下来在执行阶段时并不知道这条指令是不是同一周期流入的，可能就直接开始执行了；如果倒着运行，那么写结果后有些保留站空出来了，在同一个周期内不能重新装入新指令，但之后运行 Issue 时并不知道这个保留站是不是这个周期内空出来的，可以直接就装入新指令了。虽然可以通过添加各种状态变量来解决，但是会让代码变得复杂而难以维护。最后我的解决方案从函数式编程范式中汲取了灵感，不直接修改状态而是返回修改状态的函数，最后再统一修改。
+ CDB 的可用性问题，需要在每次写回时维护一个变量。

总的来说，这次实验不仅巩固了课堂上学到的理论知识，更锻炼了将理论应用于实践的能力。从汇编器的简单实现到 Tomasulo 核心逻辑的构建，再到前端的可视化展示，通过这个项目，我更加深入的理解了 Tomasulo 算法。

#pagebreak()

#figure(
  image("full-show.png"),
  caption: "前端页面完整展示",
)<full-show>
