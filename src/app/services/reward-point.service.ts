import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RewardPointConfig {
  rewardPointConfigId: number;
  earnAmountPerPoint: number;
  redeemValuePerPoint: number;
  minPointsToRedeem: number;
  maxRedeemAmountPerSale: number | null;
  maxRedeemPercentPerSale: number | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
}

export interface SaveRewardPointConfigRequest {
  earnAmountPerPoint: number;
  redeemValuePerPoint: number;
  minPointsToRedeem: number;
  maxRedeemAmountPerSale: number | null;
  maxRedeemPercentPerSale: number | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface RewardPointTransaction {
  rewardPointTransactionId: number;
  saleId: number | null;
  transactionType: 'Earned' | 'Redeemed' | 'Expired' | 'Adjusted';
  points: number;
  pointValueAmount: number | null;
  balanceAfter: number;
  remarks: string | null;
  createdAt: string;
}

export interface CustomerRewardPointSummary {
  customerId: number;
  rewardPointBalance: number;
  history: RewardPointTransaction[];
}

@Injectable({ providedIn: 'root' })
export class RewardPointService {
  private baseUrl = environment.baseUrl;

  constructor(private http: HttpClient) {}

  getAllConfigs(): Observable<{ success: boolean; data: RewardPointConfig[] }> {
    return this.http.get<any>(`${this.baseUrl}/reward-points/configs`);
  }

  createConfig(payload: SaveRewardPointConfigRequest): Observable<{ success: boolean; message: string; data: { rewardPointConfigId: number } }> {
    return this.http.post<any>(`${this.baseUrl}/reward-points/configs`, payload);
  }

  updateConfig(id: number, payload: SaveRewardPointConfigRequest): Observable<{ success: boolean; message: string }> {
    return this.http.put<any>(`${this.baseUrl}/reward-points/configs/${id}`, payload);
  }

  deleteConfig(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.baseUrl}/reward-points/configs/${id}`);
  }

  getCustomerSummary(customerId: number): Observable<{ success: boolean; data: CustomerRewardPointSummary }> {
    return this.http.get<any>(`${this.baseUrl}/reward-points/customers/${customerId}/summary`);
  }
}
