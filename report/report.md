# 体系结构上机2

## 实验内容

(1) 编写流水线模拟器，应该至少实现以下功能：

A. 能够模拟 MIPS 的 5 段流水线，以课堂讲授为参考；  
B. 支持图形交互或者命令交互；  
C. 支持单步执行（一次一个时钟周期）、执行到断点、执行到程序结束；  
D. 支持流水线各个段、寄存器状态的查看；  
E. 提供是否使用定向路径的功能选项；  
F. 提供程序执行后的性能统计分析；  
G. 按照 MIPS 语法，至少支持 load、store、add、beqz 操作；  
H. 要执行的程序可以直接输入，或通过文件载入的方式运行；  
I. 可以使用你喜欢的任何语言来实现；  
J. 可参考上机实验 I 中的两个模拟器中实现的功能；  

(2) 使用在(1)中 G 提到的指令，设计至少 3 种不同的代码组合，实现以下功能的演示：

A. 没有任何冲突的流水线场景；  
B. 有至少一次的 RAW 冲突；  
C. 有至少一次的分支跳转；  
D. 使用课堂讲授的内容，对上述每一种场景进行分析  

## 模拟器设计思想

我的模拟器采用 Javascript (TypeScript) 编写。选择 JS 的主要原因是为了方便制作网页前端进行演示。

整体来看，模拟器分为模拟器本身和展示前端两部分。

### 模拟器

模拟器负责汇编 MIPS 指令，模拟硬件和模拟执行指令。

#### 汇编器的简化实现

本次实验实现了一个简单的命令解析器，不支持伪指令 (`.text`, `.data` etc.)，但支持除了无符号数运算之外的大部分普通指令，包括：

- 算数类 `add, sub, addi, and, andi, or, ori, xor, xori, sll, slli, srl, srli, sra, srai`
- 内存类 `lw, sw`
- 分支类 `beq, bne, blt, bgt, ble, bge`
- pseudo-instruction `li, nop, beqz, bnez, mv, j`

> MIPS 中的 blt 等指令是 pseudo-instruction，实际上是用 `slt` 和 `bne` 实现的。为了简化实现，这里采用了类似 RISC-V 的实现方式，直接支持 `blt` 等指令。

> 伪指令的实现方式：
> - `li` 使用 `addi`
> - `nop` 使用 `add $0, $0, $0`
> - `beqz $t1, label` 使用 `beq $t1, $0, label`
> - `bnez $t1, label` 使用 `bne $t1, $0, label`
> - `mv $t1, $t2` 使用 `addi $t1, $t2, 0`
> - `j label` 使用 `beq $0, $0, label`（不符合 MIPS 标准）

对于跳转标签，可以和指令写在一行，也可以单独写在一行。

支持 `$0` 这样的寄存器表示法，也支持使用 `$t0` 这样的寄存器别名。

#### iMem, dMem 和 Register-file 的简化实现

出于方便考虑，我对简化了指令和内存的编号访问方式。将一个寄存器的长度设为一个“单位”；iMem 和 dMem 都实现为“单位”的数组，按“单位”来访问。

例如，
- `lw $1, 0($0)` 代表将 dMem[0] 的值加载到寄存器 $1 中；
- `lw $1, 1($0)` 代表将 dMem[1] 的值加载到寄存器 $1 中；
- PC 为 0 时，取 iMem[0] 指令；
- PC 为 1 时，取 iMem[1] 指令。

这样的简化主要是因为 JavaScript 中所有数字都是 IEEE 754 双精度浮点数，无法直接表示 32 位整数，这样将一个双精度浮点是当作一个“单位”对于「模拟流水线」的目标来说差异并不太大，但是在实现上会简单很多。

汇编器和硬件的实现具体使用的标准写在了 [`src/lib/simulator/spec.md`](https://github.com/yy4382/mips-pipeline/blob/main/src/lib/simulator/spec.md) 中。

#### 流水线模拟

模拟了一个标准的 MIPS 5 段流水线，IF, ID, EX, MEM 和 WB，存储了每个阶段之间的流水线寄存器的值。

支持在硬件层面（而不是依赖汇编器添加 NOP）实现 data hazard 自动插入 STALL。

分支时，总是预测为不跳转，如果预测失败，则 flush 流水线。

支持启用和不启用定向路径。

同时，模拟器提供了大量的回调和可注册的监听器，可以在模拟器内部状态改变时触发前端的更新。

### 前端

前端是一个 React 项目，可以直接在 <https://mips-pipeline-simulator.vercel.app> 上体验运行。

支持的功能：
- 单步执行
- 执行到结束
- 执行到断点
- 直接输入指令
- 载入示例指令
- 修改内存中的值

显示的内容：
- **流水线时空图**
- 指令列表和它们正处在哪个流水线阶段
- 流水线寄存器的值
- 寄存器的值
- 内存的值（可以修改）
- 性能统计信息
- 出现过的 Data hazard 和 branch prediction failure

前端主要通过各种回调函数来从模拟器监听获取数据。

在一些较久版本的浏览器中（比如我测试的 Edge 130），寄存器和内存中值的更新有可能不会立即反映在 UI 上，可能需要手动点一点它们两个组件来触发更新（其他显示组件工作的都很好），在更新的 Edge 135 和 Chrome 135 中一切正常。

## 设计特色

最大的特色在于方便直观的前端展示；基本实现了第一次实验中 MIPSsim 模拟器在显示方面的功能。

在流水线模拟器中，尽量模仿了实际 CPU 的设计，比如在流水线中，使用了命令翻译而来的控制信号来控制每个阶段的运行，而不是在每个阶段里对各种指令类型 if/else 来处理。在开发方面，也是为了方便重构，添加了大量测试，最终在模拟器模块中测试的覆盖率达到了 84%。（运行 `pnpm vitest --coverage`）

在前端方面，我设计了一个直观易用的展示界面，同时得益于 Web 生态，美观程度也好于其他大部分模拟器。同时，网页的另一个好处是可以随处直接运行，不需要下载或编译，打开浏览器即可直接运行。

## 测试代码分析

运行结果在下一个章节。

测试 1 是网页打开后的默认指令；测试 2、测试 5 和测试 7 的代码可以在网页上指令输入框下方的快速选择中直接载入。

### 1. 简单的、没有任何流水线冲突的代码

```assembly
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

### 2. RAW 冲突

```assembly
lw $t1, 0($0)
lw $t2, 1($0)
add $t3, $t1, $t2
sw $t3, 2($0)
```

不采用定向路径时，第三条指令(`index = 2`)会停顿两个周期，第四条(`index = 3`)也会停顿两个周期。（直到 WB 阶段完成后才能执行下一条的 ID 阶段）。执行结束后，共停顿 4 个周期。

如果采用定向路径，第三条会停顿一个周期（直到 MEM 段结束时数据才可用），第四条不会停顿（上一条的 EX 直接输入下一条的 EX）。执行结束后，共停顿 1 个周期，发生两次 forwarding。

### 3. 分支跳转（会跳转）

```assembly
li $1, 1
li $2, 2
beqz $0, target # Branch will be taken
add $3, $1, $1 # This should be skipped
add $3, $1, $1 # This should be skipped
target:
add $4, $1, $1 # Execution continues here
```

由于分支预测为不跳转，所以当 beqz 指令执行到 EX 结束后，会发现需要跳转而将已经开始执行的下面两条 `add` 指令 flush 掉，开始执行 `add $4, $1, $1` 指令。

### 4. 分支跳转（不会跳转）

```assembly
li $1, 1
beqz $1, target # Branch will not be taken
add $3, $1, $1 # This will be executed
add $3, $1, $1 # This will be executed
target:
add $4, $1, $1 # Execution continues here
```

由于分支预测为不跳转，所以当 beqz 指令执行到 EX 结束后，会发现不需要跳转而将已经开始执行的下面两条 `add` 指令继续执行。

### 5. 分支跳转：分支所用寄存器存在 RAW 冲突

如果正确实现了 RAW 和 branch 的冲突检测，那么这不应该是一个需要特殊处理的情况。

```assembly
li $t1, 1
li $t2, 2
li $t3, 0
beqz $t3, target
add $t4, $t1, $t2
target:
add $t5, $t1, $t2
sw $t4, 0($0)
sw $t5, 1($0)
```

最后应该可以看到 `$4` 为 0， `$5` 是 3 （内存和寄存器组件的显示在旧版浏览器中可能略有问题，最新版 Chrome 135 中一切正常）

### 6. 数据定向时需要的寄存器在 EX/MEM 和 MEM/WB 阶段的指令都将被写入

```assembly
li $t1, 1
addi $t1, $t1, 1
addi $t1, $t1, 2
addi $t1, $t1, 3
```

在最后一步中，`$1` 的值需要从之前的指令中定向而来。但是前一个指令（现在在 MEM 阶段）和前前一个指令（现在在 WB 阶段）都将 `$1` 的值写入到 `$1` 中。在这种情形中，需要从 MEM 阶段的指令中读取 `$1` 的值，而不是从 WB 阶段的指令中读取 `$1` 的值，才能获取正确的结果。

### 7. 斐波那契数列求值

从内存 0 位置中读取一个 n，计算斐波那契数列的第 n 项，存储到内存 1 位置中。

如果 n <= 0，则储存 -1。

```assembly
lw $t1, 0($0)
ble $t1, $0, invalid_input
li $t2, 0
li $t3, 1
beq $t1, $t3, return_0 # if $t1 == 1, return_0
li $t4, 2
beq $t1, $t4, return_1 # if $t1 == 2, return_1
addi $t1, $t1, -2 # because the first two fibonacci numbers are 0 and 1
loop:
  beqz $t1, end
  addi $t1, $t1, -1
  add $t4, $t2, $t3
  addi $t2, $t3, 0
  addi $t3, $t4, 0
  j loop
invalid_input:
  li $t3, -1
  j end
return_0:
  li $t3, 0
  j end
return_1:
  li $t3, 1
  j end
end:
  sw $t3, 1($0)
```

原理类似的 C 代码：

```c
int fib(int n) {
  if (n <= 0) return -1;
  if (n == 1) return 0;
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