// Mock WebSocket for testing

// Mock CloseEvent for Node.js environment
class CloseEvent {
  type: string;
  code?: number;
  reason?: string;
  wasClean: boolean;

  constructor(type: string, init?: { code?: number; reason?: string }) {
    this.type = type;
    this.code = init?.code;
    this.reason = init?.reason;
    this.wasClean = (init?.code === 1000);
  }
}

export default class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  protocols?: string | string[];
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private sentMessages: any[] = [];
  eventListeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    MockWebSocket.instances.push(this);
    
    // Simulate async connection
    setTimeout(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        if (this.onopen) {
          this.onopen(new Event('open'));
        }
        // Trigger 'open' event listeners
        const openListeners = this.eventListeners.get('open') || [];
        openListeners.forEach(listener => listener());
      }
    }, 10);
  }

  // Support ws library's event emitter pattern
  on(event: string, listener: (...args: any[]) => void) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
    return this;
  }

  // Support ws library's event emitter pattern
  off(event: string, listener: (...args: any[]) => void) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
    return this;
  }

  // Support ws library's event emitter pattern
  once(event: string, listener: (...args: any[]) => void) {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  send(data: string | ArrayBuffer | Blob) {
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.simulateClose(code, reason);
  }

  // Test helpers
  simulateMessage(data: any) {
    // Create a Buffer-like object with toString method
    const mockData = {
      toString: () => JSON.stringify(data),
    };
    
    // Trigger browser-style onmessage
    if (this.onmessage) {
      const event = { type: 'message', data: mockData } as any;
      this.onmessage(event);
    }
    
    // Trigger ws library-style 'message' event listeners
    const messageListeners = this.eventListeners.get('message') || [];
    messageListeners.forEach(listener => listener(mockData));
  }

  simulateError(error: Error) {
    // Trigger browser-style onerror
    if (this.onerror) {
      const event = new Event('error');
      (event as any).error = error;
      this.onerror(event);
    }
    
    // Trigger ws library-style 'error' event listeners
    const errorListeners = this.eventListeners.get('error') || [];
    errorListeners.forEach(listener => listener(error));
  }
  
  simulateClose(code?: number, reason?: string) {
    const closeEvent = new CloseEvent('close', { code, reason });
    
    // Trigger browser-style onclose
    if (this.onclose) {
      this.onclose(closeEvent);
    }
    
    // Trigger ws library-style 'close' event listeners
    const closeListeners = this.eventListeners.get('close') || [];
    closeListeners.forEach(listener => listener(code, reason));
    
    this.readyState = MockWebSocket.CLOSED;
  }

  getSentMessages() {
    return this.sentMessages;
  }

  static clear() {
    MockWebSocket.instances = [];
  }
}

