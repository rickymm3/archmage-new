module Battle
  class ScoutingService
    def initialize(user)
      @user = user
    end

    def call
      # Refresh if cooldown expired or list empty
      if @user.scouted_targets.nil? || @user.scouted_targets.empty? || (@user.last_scouted_at && @user.last_scouted_at < 10.minutes.ago)
        refresh_targets
      end
      
      @user.scouted_targets || []
    end
    
    def refresh!
      refresh_targets
      @user.scouted_targets
    end

    private

    def refresh_targets
      # Strategy: find targets by Rank Proximity (Global Power) + Land Proximity (Peer Size)
      
      # 1. Fetch ALL users and sort by net_power to determine ranks.
      #    (Optimized with includes to avoid N+1 queries)
      #    Note: For large userbases, this should be replaced by a cached ranking table/column.
      all_users = User.includes(user_structures: :structure, user_units: :unit)
                      .to_a
                      .sort_by { |u| -u.net_power }
      
      # 2. Determine current user's rank
      my_rank_index = all_users.index { |u| u.id == @user.id }
      
      potential_targets = []
      
      # 3. Add Rank Neighbors (If Rank 1 is 80k power, Rank 2/3 at 5k should be visible)
      if my_rank_index
         # Range: [Rank-3 ... Rank+3] excluding self
         min_idx = [0, my_rank_index - 3].max
         max_idx = [all_users.size - 1, my_rank_index + 3].min
         
         (min_idx..max_idx).each do |idx|
            target = all_users[idx]
            next if target.id == @user.id
            next if target.under_protection?
            
            potential_targets << { user: target, rank: idx + 1 }
         end
      end
      
      # 4. Add Land/Power Peers (Original Logic)
      # Ensure you can always attack someone your size, even if rank is far off
      min_land = (@user.land * 0.5).to_i
      max_land = (@user.land * 1.5).to_i
      
      land_peers = User.where(land: min_land..max_land)
                       .where.not(id: @user.id)
                       .where('protection_expires_at IS NULL OR protection_expires_at < ?', Time.current)
                       .limit(5)
                       
      land_peers.each do |peer|
         next if potential_targets.any? { |pt| pt[:user].id == peer.id }
         
         rank = all_users.index { |u| u.id == peer.id }
         next unless rank # Should exist
         
         potential_targets << { user: peer, rank: rank + 1 }
      end
      
      # 5. Fallback if empty (Random Active Players)
      if potential_targets.empty?
         randoms = User.where('land > ?', 10).where.not(id: @user.id)
                       .where('protection_expires_at IS NULL OR protection_expires_at < ?', Time.current)
                       .order("RANDOM()")
                       .limit(3)
                       
         randoms.each do |r|
            next if potential_targets.any? { |pt| pt[:user].id == r.id }
            rank = all_users.index { |u| u.id == r.id }
            potential_targets << { user: r, rank: (rank || 0) + 1 }
         end
      end
      
      # Limit total to 8, shuffle for variety
      final_list = potential_targets.uniq { |pt| pt[:user].id }.sample(8)
      
      # Serialize
      data = final_list.map do |pt|
        u = pt[:user]
        {
          id: u.id,
          name: u.display_kingdom_name, 
          rank: pt[:rank], 
          land: u.land,
          power_estimate: u.net_power,
          avatar_color: u.color
        }
      end
      
      @user.update(scouted_targets: data, last_scouted_at: Time.current)
    end
  end
end
