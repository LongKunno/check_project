/**
 * RankBadge — Shared rank badge component (Gold/Silver/Bronze/Default)
 * 
 * Used in ProjectScoresView and MemberScoresView leaderboard tables.
 */
import React from "react";
import { Star } from "lucide-react";

export function RankBadge({ rank }) {
    if (rank === 1)
        return (
            <div className="rank-badge rank-badge-gold">
                <Star size={12} />
            </div>
        );
    if (rank === 2)
        return (
            <div className="rank-badge rank-badge-silver">
                <Star size={12} />
            </div>
        );
    if (rank === 3)
        return (
            <div className="rank-badge rank-badge-bronze">
                <Star size={12} />
            </div>
        );
    return <div className="rank-badge rank-badge-default">{rank}</div>;
}

export default RankBadge;
