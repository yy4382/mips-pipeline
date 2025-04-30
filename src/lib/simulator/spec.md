# SPEC of Simulator

实现了一个 MIPS 极小的、略有修改（以简化实现）的子集。

## 指令格式

由于本实验的主要目的是实现流水线而不是实现汇编器，因此指令格式被修改地尽量简单。

### 寄存器表示

支持 `$0` 这样的寄存器表示法，也支持使用 `$t0` 这样的寄存器别名。

### PC

本模拟器中的 PC 是指令条数的数量，而不是字节数。因此，每运行一条指令后，PC 加 1。
同时，跳转时的偏移量是指令条数的数量，而不是字节数。

### IMem

指令从0开始逐一编号，没有"每个指令的字节长度"概念。直接使用 PC 的值访问对应编号的指令。

### DMem

内存容量为 32 个寄存器长度。每个寄存器在实现时是一个 Javascript Number (IEEE 754 双精度浮点数)，但是在模拟器中使用时可以看作一个 32 bit 的比特串。

和 PC 类似，因为没有"字节"概念，每次访问内存时都直接取取一个寄存器长度的内存单元。(lw, sw 里的 word的意思也随之变换为一个寄存器长度的内存单元)

### 支持的指令

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

不支持 `.data` 和 `.text` 这样的 assembler directive。


## 流水线详情

标准五段流水线。IF-> ID -> EX -> MEM -> WB

### Data Hazard

- 硬件（非编译阶段）实现的自动插入 Stall 来解决 data hazard。
- 支持开启旁路定向缓解 data hazard。

### Control Hazard

- 永远预测分支失败，如果预测失败，则 flush 流水线。

