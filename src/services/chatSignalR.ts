import { 
  HubConnectionBuilder, 
  HubConnection, 
  HttpTransportType, 
  HubConnectionState 
} from '@microsoft/signalr';

export type SignalRConnectionStatus = 'Connected' | 'Connecting' | 'Reconnecting' | 'Disconnected';

export interface TypingNotification {
  conversationId: number;
  userId: number;
  userName: string;
  isTyping: boolean;
}

export interface ConversationUpdateNotification {
  conversationId: number;
  lastMessage: {
    id: number;
    content: string;
    messageType: string;
    createdAt: string;
    senderId: number;
    senderName: string | null;
    isDeleted?: boolean;
  };
}

class ChatSignalRService {
  private connection: HubConnection | null = null;
  private statusListeners: ((status: SignalRConnectionStatus) => void)[] = [];
  private currentStatus: SignalRConnectionStatus = 'Disconnected';

  public getStatus(): SignalRConnectionStatus {
    return this.currentStatus;
  }

  private setStatus(status: SignalRConnectionStatus) {
    this.currentStatus = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  public onStatusChange(listener: (status: SignalRConnectionStatus) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  public async startConnection(): Promise<HubConnection | null> {
    const token = localStorage.getItem('token');
    if (!token) {
      this.setStatus('Disconnected');
      return null;
    }

    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      this.setStatus('Connected');
      return this.connection;
    }

    if (this.connection && this.connection.state === HubConnectionState.Connecting) {
      return this.connection;
    }

    try {
      this.setStatus('Connecting');

      this.connection = new HubConnectionBuilder()
        .withUrl('http://localhost:5000/hubs/chat', {
          accessTokenFactory: () => localStorage.getItem('token') || '',
          transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents | HttpTransportType.LongPolling,
          withCredentials: true
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 20000])
        .build();

      this.connection.onreconnecting(() => {
        this.setStatus('Reconnecting');
      });

      this.connection.onreconnected(() => {
        this.setStatus('Connected');
      });

      this.connection.onclose(() => {
        this.setStatus('Disconnected');
      });

      await this.connection.start();
      this.setStatus('Connected');
      return this.connection;
    } catch (err) {
      console.warn('SignalR connection failed, falling back to HTTP polling:', err);
      this.setStatus('Disconnected');
      return null;
    }
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.stop();
      } catch (err) {
        console.error('Error stopping SignalR connection:', err);
      } finally {
        this.connection = null;
        this.setStatus('Disconnected');
      }
    }
  }

  public async joinConversation(conversationId: number): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      try {
        await this.connection.invoke('JoinConversation', conversationId);
      } catch (err) {
        console.warn(`Error joining SignalR conversation ${conversationId}:`, err);
      }
    }
  }

  public async leaveConversation(conversationId: number): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      try {
        await this.connection.invoke('LeaveConversation', conversationId);
      } catch (err) {
        console.warn(`Error leaving SignalR conversation ${conversationId}:`, err);
      }
    }
  }

  public async sendMessage(conversationId: number, content: string, messageType = 'Text'): Promise<boolean> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      try {
        await this.connection.invoke('SendMessage', conversationId, content, messageType);
        return true;
      } catch (err) {
        console.warn('SignalR SendMessage failed, fallback to HTTP:', err);
        return false;
      }
    }
    return false;
  }

  public async sendTyping(conversationId: number, isTyping: boolean): Promise<void> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      try {
        await this.connection.invoke('SendTyping', conversationId, isTyping);
      } catch (err) {
        // Silently ignore typing send failures
      }
    }
  }

  public onReceiveMessage(callback: (message: any) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('ReceiveMessage', callback);
    return () => {
      this.connection?.off('ReceiveMessage', callback);
    };
  }

  public onMessageEdited(callback: (data: { id: number; conversationId: number; content: string; editedAt: string }) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('MessageEdited', callback);
    return () => {
      this.connection?.off('MessageEdited', callback);
    };
  }

  public onMessageDeleted(callback: (data: { messageId: number; conversationId: number }) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('MessageDeleted', callback);
    return () => {
      this.connection?.off('MessageDeleted', callback);
    };
  }

  public onUserTyping(callback: (data: TypingNotification) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('UserTyping', callback);
    return () => {
      this.connection?.off('UserTyping', callback);
    };
  }

  public onConversationUpdated(callback: (data: ConversationUpdateNotification) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('ConversationUpdated', callback);
    return () => {
      this.connection?.off('ConversationUpdated', callback);
    };
  }
}

export const chatSignalR = new ChatSignalRService();
export default chatSignalR;
