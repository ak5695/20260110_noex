/**
 * 企业级绑定管理服务
 *
 * 设计原则：
 * 1. 单一数据源：Canvas元素状态是唯一真相
 * 2. 立即同步：所有变更立即传播到UI和数据库
 * 3. 零幽灵绑定：删除/解绑自动清理所有痕迹
 * 4. 事件驱动：通过CustomEvent解耦组件
 */

export interface CanvasBinding {
  id: string;
  canvasId: string;
  documentId: string;
  elementId: string;
  blockId: string;
  anchorText: string;
  bindingType: string;
  status: string;
  provenance: string;
  isElementDeleted?: boolean;
}

export interface BindingChangeEvent {
  type: 'created' | 'deleted' | 'element-deleted' | 'element-restored';
  binding?: CanvasBinding;
  elementId?: string;
  elementIds?: string[];
}

/**
 * 绑定服务事件
 */
export const BINDING_EVENTS = {
  CREATED: 'binding:created',
  DELETED: 'binding:deleted',
  ELEMENT_DELETED: 'binding:element-deleted',
  ELEMENT_RESTORED: 'binding:element-restored',
  SYNC_COMPLETE: 'binding:sync-complete',
  ERROR: 'binding:error',
} as const;

/**
 * 绑定管理服务（单例）
 */
class BindingService {
  private bindings: Map<string, CanvasBinding> = new Map();
  private elementToBinding: Map<string, string> = new Map(); // elementId -> bindingId
  private blockToBindings: Map<string, Set<string>> = new Map(); // blockId -> Set<bindingId>
  private deletedElements: Set<string> = new Set();

  /**
   * 初始化绑定列表
   */
  initialize(bindings: CanvasBinding[]) {
    this.bindings.clear();
    this.elementToBinding.clear();
    this.blockToBindings.clear();
    this.deletedElements.clear();

    bindings.forEach(binding => {
      this.bindings.set(binding.id, binding);
      this.elementToBinding.set(binding.elementId, binding.id);

      if (!this.blockToBindings.has(binding.blockId)) {
        this.blockToBindings.set(binding.blockId, new Set());
      }
      this.blockToBindings.get(binding.blockId)!.add(binding.id);

      // 初始化已删除元素集合
      if (binding.isElementDeleted) {
        this.deletedElements.add(binding.elementId);
      }
    });

    console.log('[BindingService] Initialized with', bindings.length, 'bindings');
  }

  /**
   * 添加新绑定
   */
  addBinding(binding: CanvasBinding) {
    this.bindings.set(binding.id, binding);
    this.elementToBinding.set(binding.elementId, binding.id);

    if (!this.blockToBindings.has(binding.blockId)) {
      this.blockToBindings.set(binding.blockId, new Set());
    }
    this.blockToBindings.get(binding.blockId)!.add(binding.id);

    // 触发事件
    this.dispatchEvent(BINDING_EVENTS.CREATED, { type: 'created', binding });
  }

  /**
   * 删除绑定（同时清理所有索引）
   */
  deleteBinding(bindingId: string) {
    const binding = this.bindings.get(bindingId);
    if (!binding) return;

    // 清理所有索引
    this.bindings.delete(bindingId);
    this.elementToBinding.delete(binding.elementId);
    this.deletedElements.delete(binding.elementId);

    const blockBindings = this.blockToBindings.get(binding.blockId);
    if (blockBindings) {
      blockBindings.delete(bindingId);
      if (blockBindings.size === 0) {
        this.blockToBindings.delete(binding.blockId);
      }
    }

    // 触发事件
    this.dispatchEvent(BINDING_EVENTS.DELETED, {
      type: 'deleted',
      binding,
      elementId: binding.elementId
    });
  }

  /**
   * 标记元素为已删除（软删除）
   */
  markElementsAsDeleted(elementIds: string[]) {
    const affectedBindings: CanvasBinding[] = [];

    elementIds.forEach(elementId => {
      const bindingId = this.elementToBinding.get(elementId);
      if (bindingId) {
        const binding = this.bindings.get(bindingId);
        if (binding && !binding.isElementDeleted) {
          // 更新绑定状态
          binding.isElementDeleted = true;
          this.deletedElements.add(elementId);
          affectedBindings.push(binding);
        }
      }
    });

    if (affectedBindings.length > 0) {
      console.log('[BindingService] Marked', affectedBindings.length, 'elements as deleted');

      // 触发事件
      this.dispatchEvent(BINDING_EVENTS.ELEMENT_DELETED, {
        type: 'element-deleted',
        elementIds
      });
    }
  }

  /**
   * 恢复已删除的元素
   */
  restoreElements(elementIds: string[]) {
    const affectedBindings: CanvasBinding[] = [];

    elementIds.forEach(elementId => {
      const bindingId = this.elementToBinding.get(elementId);
      if (bindingId) {
        const binding = this.bindings.get(bindingId);
        if (binding && binding.isElementDeleted) {
          binding.isElementDeleted = false;
          this.deletedElements.delete(elementId);
          affectedBindings.push(binding);
        }
      }
    });

    if (affectedBindings.length > 0) {
      console.log('[BindingService] Restored', affectedBindings.length, 'elements');

      this.dispatchEvent(BINDING_EVENTS.ELEMENT_RESTORED, {
        type: 'element-restored',
        elementIds
      });
    }
  }

  /**
   * 获取所有活跃绑定（排除已删除元素）
   */
  getActiveBindings(): CanvasBinding[] {
    return Array.from(this.bindings.values()).filter(b => !b.isElementDeleted);
  }

  /**
   * 获取所有绑定（包括已删除）
   */
  getAllBindings(): CanvasBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * 通过元素ID查找绑定
   */
  getBindingByElementId(elementId: string): CanvasBinding | undefined {
    const bindingId = this.elementToBinding.get(elementId);
    return bindingId ? this.bindings.get(bindingId) : undefined;
  }

  /**
   * 通过块ID查找所有绑定
   */
  getBindingsByBlockId(blockId: string): CanvasBinding[] {
    const bindingIds = this.blockToBindings.get(blockId);
    if (!bindingIds) return [];

    return Array.from(bindingIds)
      .map(id => this.bindings.get(id))
      .filter((b): b is CanvasBinding => b !== undefined);
  }

  /**
   * 检查元素是否被删除
   */
  isElementDeleted(elementId: string): boolean {
    return this.deletedElements.has(elementId);
  }

  /**
   * 检查块是否有绑定
   */
  hasBindingsForBlock(blockId: string): boolean {
    const bindings = this.getBindingsByBlockId(blockId);
    return bindings.some(b => !b.isElementDeleted);
  }

  /**
   * 触发自定义事件
   */
  private dispatchEvent(eventType: string, detail: BindingChangeEvent) {
    window.dispatchEvent(new CustomEvent(eventType, { detail }));
  }

  /**
   * 清空所有数据
   */
  clear() {
    this.bindings.clear();
    this.elementToBinding.clear();
    this.blockToBindings.clear();
    this.deletedElements.clear();
  }
}

// 导出单例
export const bindingService = new BindingService();

/**
 * React Hook：监听绑定变更
 */
export function useBindingEvents(
  onCreated?: (binding: CanvasBinding) => void,
  onDeleted?: (binding: CanvasBinding, elementId: string) => void,
  onElementDeleted?: (elementIds: string[]) => void,
  onElementRestored?: (elementIds: string[]) => void
) {
  if (typeof window === 'undefined') return;

  const handleEvent = (e: Event) => {
    const customEvent = e as CustomEvent<BindingChangeEvent>;
    const { type, binding, elementId, elementIds } = customEvent.detail;

    switch (type) {
      case 'created':
        if (binding && onCreated) onCreated(binding);
        break;
      case 'deleted':
        if (binding && elementId && onDeleted) onDeleted(binding, elementId);
        break;
      case 'element-deleted':
        if (elementIds && onElementDeleted) onElementDeleted(elementIds);
        break;
      case 'element-restored':
        if (elementIds && onElementRestored) onElementRestored(elementIds);
        break;
    }
  };

  // 注册所有事件监听
  Object.values(BINDING_EVENTS).forEach(eventType => {
    window.addEventListener(eventType, handleEvent);
  });

  // 清理函数
  return () => {
    Object.values(BINDING_EVENTS).forEach(eventType => {
      window.removeEventListener(eventType, handleEvent);
    });
  };
}
