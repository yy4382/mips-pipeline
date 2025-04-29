import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Memory } from './memory';

const MEMORY_SIZE = 32; // Assuming this is the size defined in memory.ts

describe('Memory', () => {
  let memory: Memory;

  beforeEach(() => {
    memory = new Memory();
    // Mock console.warn to check if it's called
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should initialize with the correct size and all zeros', () => {
    expect(memory.getSize()).toBe(MEMORY_SIZE);
    const memArray = memory.getMemory();
    expect(memArray).toHaveLength(MEMORY_SIZE);
    expect(memArray.every((val) => val === 0)).toBe(true);
  });

  describe('getAt', () => {
    it('should return the value at a valid index', () => {
      memory.setAt(5, 123);
      expect(memory.getAt(5)).toBe(123);
    });

    it('should return 0 for an uninitialized index', () => {
      expect(memory.getAt(10)).toBe(0);
    });

    it('should throw an error for an index less than 0', () => {
      expect(() => memory.getAt(-1)).toThrow('Memory index out of bounds: -1');
    });

    it('should throw an error for an index equal to MEMORY_SIZE', () => {
      expect(() => memory.getAt(MEMORY_SIZE)).toThrow(
        `Memory index out of bounds: ${MEMORY_SIZE}`
      );
    });

    it('should throw an error for an index greater than MEMORY_SIZE', () => {
      expect(() => memory.getAt(MEMORY_SIZE + 1)).toThrow(
        `Memory index out of bounds: ${MEMORY_SIZE + 1}`
      );
    });
  });

  describe('setAt', () => {
    it('should set the value at a valid index', () => {
      memory.setAt(15, 456);
      expect(memory.getAt(15)).toBe(456);
    });

    it('should allow setting value at index 0', () => {
      memory.setAt(0, 789);
      expect(memory.getAt(0)).toBe(789);
    });

    it('should allow setting value at the last valid index', () => {
      memory.setAt(MEMORY_SIZE - 1, 987);
      expect(memory.getAt(MEMORY_SIZE - 1)).toBe(987);
    });

    it('should handle setting the same value multiple times', () => {
      memory.setAt(20, 111);
      expect(memory.getAt(20)).toBe(111);
      memory.setAt(20, 111); // Set the same value again
      expect(memory.getAt(20)).toBe(111);
    });

    it('should throw an error for an index less than 0', () => {
      expect(() => memory.setAt(-1, 100)).toThrow(
        'Memory index out of bounds: -1'
      );
    });

    it('should throw an error for an index equal to MEMORY_SIZE', () => {
      expect(() => memory.setAt(MEMORY_SIZE, 100)).toThrow(
        `Memory index out of bounds: ${MEMORY_SIZE}`
      );
    });

    it('should throw an error for an index greater than MEMORY_SIZE', () => {
      expect(() => memory.setAt(MEMORY_SIZE + 1, 100)).toThrow(
        `Memory index out of bounds: ${MEMORY_SIZE + 1}`
      );
    });

    it('should warn and set to 0 if a non-numeric value is provided and current value is non-zero', () => {
      memory.setAt(5, 123); // Set an initial non-zero value
      expect(memory.getAt(5)).toBe(123);
      // @ts-expect-error Testing invalid input type
      memory.setAt(5, 'invalid');
      expect(console.warn).toHaveBeenCalledWith(
        'Attempted to set non-numeric value at index 5: invalid'
      );
      expect(memory.getAt(5)).toBe(0); // Should default to 0
    });

     it('should warn but not change value if a non-numeric value is provided and current value is already 0', () => {
      expect(memory.getAt(6)).toBe(0); // Ensure initial value is 0
      memory.setAt(6, NaN);
      expect(console.warn).toHaveBeenCalledWith(
        'Attempted to set non-numeric value at index 6: NaN'
      );
      expect(memory.getAt(6)).toBe(0); // Should remain 0
    });

    it('should handle numeric strings correctly', () => {
      // @ts-expect-error Testing string input that converts to number
      memory.setAt(7, '255');
      expect(memory.getAt(7)).toBe(255);
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all memory locations to 0', () => {
      memory.setAt(5, 100);
      memory.setAt(10, 200);
      memory.reset();
      const memArray = memory.getMemory();
      expect(memArray.every((val) => val === 0)).toBe(true);
      expect(memory.getAt(5)).toBe(0);
      expect(memory.getAt(10)).toBe(0);
    });
  });

  describe('getSize', () => {
    it('should return the correct memory size', () => {
      expect(memory.getSize()).toBe(MEMORY_SIZE);
    });
  });

  describe('getMemory', () => {
    it('should return a copy of the memory array', () => {
      memory.setAt(0, 1);
      memory.setAt(MEMORY_SIZE - 1, 2);
      const memArray = memory.getMemory();
      expect(memArray).toHaveLength(MEMORY_SIZE);
      expect(memArray[0]).toBe(1);
      expect(memArray[MEMORY_SIZE - 1]).toBe(2);
      expect(memArray[1]).toBe(0); // Check an uninitialized element
    });

    it('should return a read-only copy (modifying the copy should not affect original)', () => {
      memory.setAt(3, 33);
      const memArray = memory.getMemory();
      // @ts-expect-error Testing immutability
      memArray[3] = 99; // Modify the returned copy
      expect(memory.getAt(3)).toBe(33); // Original should be unchanged
    });
  });
});
