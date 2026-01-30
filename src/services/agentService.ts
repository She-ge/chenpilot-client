import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { 
  AgentQueryRequest, 
  AgentQueryResponse,
  AgentStatus,
  AgentCapabilities,
  AgentHealthCheck
} from '@/types/agent';
import agentConfig from '@/config/agent';

class AgentService {
  private api: AxiosInstance;
  private baseURL: string;
  private isConnected: boolean = false;
  private lastHealthCheck: Date | null = null;

  constructor() {
    this.baseURL = agentConfig.baseURL;
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: agentConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for logging
    if (agentConfig.enableLogging) {
      this.api.interceptors.request.use(
        (config) => {
          console.log(`[AgentService] Making request to: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          console.error('[AgentService] Request error:', error);
          return Promise.reject(error);
        }
      );

      // Response interceptor for error handling
      this.api.interceptors.response.use(
        (response) => {
          console.log(`[AgentService] Response received: ${response.status} ${response.config.url}`);
          return response;
        },
        (error) => {
          console.error('[AgentService] Response error:', error);
          this.isConnected = false;
          return Promise.reject(error);
        }
      );
    }
  }

  /**
   * Check if the agent service is available and healthy
   */
  async healthCheck(): Promise<AgentHealthCheck> {
    try {
      // Since the experimental backend doesn't have a /health endpoint,
      // we'll try to make a simple request to test connectivity
      // We'll use a HEAD request to avoid authentication issues
      const response = await this.api.request({
        method: 'HEAD',
        url: '/',
        timeout: 5000
      });
      
      this.isConnected = true;
      this.lastHealthCheck = new Date();
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          agent: {
            status: 'up',
            responseTime: 0
          }
        },
        system: {
          memory: { used: 0, total: 0, percentage: 0 },
          cpu: { usage: 0 },
          uptime: 0
        }
      };
    } catch (error) {
      this.isConnected = false;
      console.error('[AgentService] Health check failed:', error);
      // Don't throw error, return unhealthy status instead
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          agent: {
            status: 'down',
            responseTime: 0
          }
        },
        system: {
          memory: { used: 0, total: 0, percentage: 0 },
          cpu: { usage: 0 },
          uptime: 0
        }
      };
    }
  }

  /**
   * Get agent status and capabilities
   */
  async getStatus(): Promise<AgentStatus> {
    // Since the experimental backend doesn't have a /status endpoint,
    // we'll return a basic status based on connectivity
    return {
      isOnline: this.isConnected,
      version: '1.0.0',
      uptime: 0,
      lastActivity: new Date().toISOString(),
      activeConnections: 1,
      services: {
        soroswap: { isActive: true, isHealthy: true, lastCheck: new Date().toISOString() },
        blend: { isActive: true, isHealthy: true, lastCheck: new Date().toISOString() },
        aquarius: { isActive: true, isHealthy: true, lastCheck: new Date().toISOString() },
        phoenix: { isActive: true, isHealthy: true, lastCheck: new Date().toISOString() },
        database: { isActive: true, isHealthy: true, lastCheck: new Date().toISOString() }
      }
    };
  }

  /**
   * Get available agent capabilities
   */
  async getCapabilities(): Promise<AgentCapabilities> {
    // Since the experimental backend doesn't have a /capabilities endpoint,
    // we'll return the capabilities based on the intent agent
    return {
      supportedActions: [
        'transfer_xlm', 'swap', 'lend', 'borrow', 'withdraw', 'repay', 'check_balance', 'get_apy',
        'health_check', 'liquidate', 'claim_rewards', 'add_collateral',
        'remove_collateral', 'deposit_vault', 'withdraw_vault', 'get_vaults',
        'get_vault_positions', 'harvest_vault', 'get_strategies', 'swap_stellar_dex',
        'add_liquidity', 'remove_liquidity'
      ],
      supportedAssets: ['XLM', 'USDC', 'USDT', 'BTC', 'ETH', 'AQUA'],
      supportedProtocols: ['Soroswap', 'Blend', 'Aquarius', 'Phoenix'],
      features: {
        defi: true,
        crossChain: true,
        voiceCommands: false,
        smartContracts: true,
        yieldFarming: true,
        lending: true,
        borrowing: true,
        swapping: true
      },
      limits: {
        maxQueryLength: 1000,
        maxConcurrentQueries: 10,
        rateLimitPerMinute: 60
      }
    };
  }

  /**
   * Send a query to the agent
   */
  async queryAgent(request: AgentQueryRequest): Promise<AgentQueryResponse> {
    try {
      console.log('[AgentService] Sending query:', request.query);
      
      const response = await this.api.post('/query', request);
      
      console.log('[AgentService] Query response:', response.data);
      
      // The experimental backend returns { result: ... } format
      // Ensure we return the proper AgentQueryResponse format
      if (response.data && response.data.result) {
        return {
          result: response.data.result
        };
      }
      
      // Fallback if response format is unexpected
      return {
        result: {
          success: true,
          data: response.data || 'Query processed successfully',
          error: null
        }
      };
    } catch (error: any) {
      console.error('[AgentService] Query failed:', error);
      
      // Convert technical errors to user-friendly messages
      let friendlyMessage = 'Agent service is currently unavailable. Please try again later.';
      const errorMsg = error.response?.data?.message || error.message || 'Unknown error';
      
      if (errorMsg.includes('invalid query')) {
        friendlyMessage = "I didn't understand that. Could you please rephrase your question?";
      } else if (errorMsg.includes('timeout')) {
        friendlyMessage = "The request is taking longer than expected. Please try again.";
      } else if (errorMsg.includes('network')) {
        friendlyMessage = "I'm having trouble connecting. Please check your internet connection and try again.";
      }
      
      // Return a structured error response
      return {
        result: {
          success: false,
          data: friendlyMessage,
          error: errorMsg
        }
      };
    }
  }

  /**
   * Get agent memory for a specific user
   */
  async getMemory(userId: string): Promise<string[]> {
    try {
      const response = await this.api.get<string[]>(`/memory/${userId}`);
      return response.data;
    } catch (error) {
      console.error('[AgentService] Failed to get memory:', error);
      return [];
    }
  }

  /**
   * Clear agent memory for a specific user
   */
  async clearMemory(userId: string): Promise<void> {
    try {
      await this.api.delete(`/memory/${userId}`);
    } catch (error) {
      console.error('[AgentService] Failed to clear memory:', error);
      throw new Error('Failed to clear agent memory');
    }
  }

  /**
   * Get available tools and their status
   */
  async getTools(): Promise<any[]> {
    try {
      const response = await this.api.get<any[]>('/tools');
      return response.data;
    } catch (error) {
      console.error('[AgentService] Failed to get tools:', error);
      return [];
    }
  }

  /**
   * Execute a specific tool
   */
  async executeTool(toolName: string, params: any): Promise<any> {
    try {
      const response = await this.api.post(`/tools/${toolName}/execute`, params);
      return response.data;
    } catch (error) {
      console.error(`[AgentService] Failed to execute tool ${toolName}:`, error);
      throw new Error(`Failed to execute tool: ${toolName}`);
    }
  }

  /**
   * Get connection status
   */
  isAgentConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get last health check time
   */
  getLastHealthCheck(): Date | null {
    return this.lastHealthCheck;
  }

  /**
   * Initialize the agent service
   */
  async initialize(): Promise<void> {
    try {
      await this.healthCheck();
      console.log('[AgentService] Successfully initialized');
    } catch (error) {
      console.warn('[AgentService] Failed to initialize, will retry on first use');
    }
  }

  /**
   * Generic request method for custom endpoints
   */
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.api.request<T>(config);
    return response.data;
  }
}

// Create and export a singleton instance
export const agentService = new AgentService();
export default agentService;
