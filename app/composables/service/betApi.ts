import { useApiInterceptor } from "../api/useApiInterceptor";

export interface CreateBetResponse {
  success: boolean
  message: string
  status_code: number
  data: {
    bet: Bet
  }
}

export interface Bet {
  member_id: number
  session_id: number
  bet_id: number
  bet_uuid: string
  bet_amount: string
  fish_type_id: number
  cannon_type_id: number
  is_boss: boolean
  result: BetResult
}

export interface BetResult {
  is_kill: boolean
  is_reward: boolean
  is_jackpot: boolean
  reward: Reward
}

export interface Reward {
  kill_reward: KillReward
  miss_reward: MissReward
  jackpot_reward: JackpotReward
  base_payout_amount: string
  total_payout_amount: string
}

export interface KillReward {
  reward_odd: string
  reward_amount: string
}

export interface MissReward {
  reward_amount: string
}

export interface JackpotReward {
  payout_amount: string
  contribution_amount: string
}

export async function createBet(payload: { session_id: number; fish_type_id: number; cannon_type_id: number; elapsed_seconds: string, currency_id: number }) {
    return useApiInterceptor<CreateBetResponse>(
        "/bets",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    )
}