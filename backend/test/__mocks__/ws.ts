// Manual mock for 'ws' module - Jest will automatically use this
const mockInstances: any[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  
  onopen: (() => void) | null = null;
  onmessage: ((data: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: Error) => void) | null = null;
  readyState: number = MockWebSocket.CONNECTING;
  
  constructor(public url: string) {
    mockInstances.push(this);
    (global as any).__mockWsInstances = mockInstances;
  }
  
  send(data: string) {
    // Mock send
  }
  
  close() {
    this.readyState = MockWebSocket.CLOSING;
    if (this.onclose) {
      setTimeout(() => {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.();
      }, 0);
    }
  }
}

export default MockWebSocket;

