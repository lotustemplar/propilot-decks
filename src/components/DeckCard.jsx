import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Star, Zap, ChevronRight, Bell } from 'lucide-react';
import ElementalOverlay from './ElementalOverlay';
import DifficultyMeter from './DifficultyMeter';
import { colorMeta } from '../data/decks';

const BRACKET_COLOR = {
  2: 'text-green-400',
  3: 'text-yellow-400',
};

function ColorDot({ color }) {
  const meta = colorMeta[color];
  if (!meta) return null;
  return (
    <span
      title={meta.label}
      className="inline-block w-4 h-4 rounded-full border border-white/20"
      style={{ backgroundColor: meta.hex }}
    />
  );
}

const QUICK_STRATEGY_TIPS = {
  Aggro: "Attack early and often. Win before opponents stabilize.",
  Tokens: "Flood the board, then swing wide for overwhelming attacks.",
  Aristocrats: "Sacrifice creatures for value, drain life repeatedly.",
  Sacrifice: "Every death triggers powerful effects. Sac outlets are key.",
  Spellslinger: "Cast spells for bonus effects. Protect your engine.",
  Ramp: "Get lots of mana fast, then drop game-winning threats.",
  Lifegain: "Gain life for triggers. Out-value opponents over time.",
  Control: "Answer threats, draw cards, win with one big payoff.",
  Reanimator: "Fill graveyard, reanimate huge threats for cheap.",
  Storm: "Chain spells in one explosive turn. Win out of nowhere.",
  Counters: "Stack +1/+1 counters, proliferate, grow unstoppable.",
  Tribal: "Play creatures that share a type, get group bonuses.",
  Drain: "Drain life with each action. Choke opponents slowly.",
  'Go Wide': "Many small creatures beat large single threats.",
  Superfriends: "Protect planeswalkers. Their ultimates win the game.",
};

export default function DeckCard({ deck, animationsEnabled }) {
  const [hovered, setHovered] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  const soldOut  = deck.quantity === 0 || deck.inStock === false;
  const lowStock = !soldOut && deck.quantity > 0 && deck.quantity <= 3;

  const primaryTag = deck.playstyles[0];
  const strategyTip = QUICK_STRATEGY_TIPS[primaryTag] || deck.description;

  const isPremium = !!deck.premium;

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className={`relative group rounded-2xl overflow-hidden glass deck-card-hover ${
          isPremium ? 'fire-border' : 'border border-white/8'
        }`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={!isPremium ? {
          boxShadow: hovered
            ? `0 20px 60px ${deck.accentColor}33, 0 0 0 1px ${deck.accentColor}44`
            : '0 4px 24px rgba(0,0,0,0.4)',
        } : undefined}
      >
        {/* Art panel — 1:1 square */}
        <div
          className="relative aspect-square w-full overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${deck.gradientFrom}, ${deck.gradientTo})` }}
        >
          {/* Real artwork */}
          {deck.image ? (
            <img
              src={deck.image}
              alt={deck.name}
              className="absolute inset-0 w-full h-full object-contain transition-transform duration-500"
              style={{ transform: hovered ? 'scale(1.04)' : 'scale(1.0)' }}
            />
          ) : (
            /* Gradient placeholder when no image */
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-20 h-20 rounded-full opacity-30 transition-all duration-500"
                style={{
                  background: deck.accentColor,
                  filter: `blur(${hovered ? '15px' : '25px'})`,
                  transform: hovered ? 'scale(1.3)' : 'scale(1)',
                }}
              />
              <div className="absolute text-6xl opacity-20 select-none">⚔</div>
            </div>
          )}

          {/* Dark vignette over image so badges stay readable */}
          {deck.image && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/30 pointer-events-none" />
          )}

          {/* Elemental overlay on hover */}
          {animationsEnabled && hovered && (
            <ElementalOverlay colors={deck.colors} enabled={true} />
          )}

          {/* Sold-out overlay */}
          {soldOut && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-10">
              <div className="text-white font-black text-2xl tracking-widest uppercase mb-1" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                Sold Out
              </div>
              <div className="text-gray-400 text-xs">Join the waitlist →</div>
            </div>
          )}

          {/* Low-stock ribbon */}
          {lowStock && (
            <div className="absolute bottom-12 left-0 right-0 flex justify-center z-10">
              <div className="px-3 py-1 rounded-full bg-orange-500/90 text-white text-xs font-bold shadow-lg">
                ⚡ Only {deck.quantity} left
              </div>
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-black/60 border border-white/10 ${BRACKET_COLOR[deck.bracket]}`}>
              Bracket {deck.bracket}
            </span>
            {isPremium ? (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap"
                style={{
                  background: 'linear-gradient(135deg, rgba(200,50,0,0.45), rgba(255,120,0,0.35))',
                  border: '1px solid rgba(255,120,0,0.55)',
                  color: '#ffb347',
                  textShadow: '0 0 8px rgba(255,120,0,0.6)',
                }}
              >
                🔥 LIMITED EDITION PREMIUM
              </span>
            ) : deck.featured && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 flex items-center gap-1">
                <Star size={9} fill="currentColor" /> Featured
              </span>
            )}
          </div>

          {/* Price badge */}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
            <div className="px-2.5 py-0.5 rounded-full bg-black/70 border border-white/15 text-white font-bold text-sm">
              {deck.elitePrice ? `From $${deck.price}` : `$${deck.price}`}
            </div>
            {deck.elitePrice && (
              <div className="px-2 py-0.5 rounded-full bg-black/70 border border-white/15 text-[10px] font-bold tracking-wide flex items-center gap-1">
                <span className="text-gray-400">CORE</span>
                <span className="text-white/30">·</span>
                <span style={{ color: deck.accentColor }}>ELITE</span>
              </div>
            )}
          </div>

          {/* Color identity dots - bottom */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {deck.colors.map(c => <ColorDot key={c} color={c} />)}
            <span className="text-xs text-gray-400 ml-1">{deck.colorLabel}</span>
          </div>
        </div>

        {/* Card body */}
        <div className="p-4">
          <div className="mb-1">
            <h3 className="font-display font-bold text-lg text-white leading-tight group-hover:text-blue-300 transition-colors mb-2">
              {deck.name}
            </h3>
            <DifficultyMeter value={deck.difficulty} variant="compact" />
          </div>

          <p className="text-xs text-gray-500 mb-2 font-medium">Commander: {deck.commander}</p>

          <p className="text-sm text-gray-400 leading-relaxed mb-3 line-clamp-2">{deck.description}</p>

          {/* Playstyle tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {deck.playstyles.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${deck.accentColor}18`,
                  color: deck.accentColor,
                  border: `1px solid ${deck.accentColor}33`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {soldOut ? (
              <Link
                to={`/deck/${deck.slug ?? deck.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold
                  text-white transition-all duration-200 bg-white/8 border border-white/15 hover:bg-white/12"
              >
                <Bell size={14} /> Notify Me
              </Link>
            ) : (
              <Link
                to={`/deck/${deck.slug ?? deck.id}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold
                  text-white transition-all duration-200"
                style={{
                  background: `linear-gradient(135deg, ${deck.accentColor}cc, ${deck.accentColor}88)`,
                  boxShadow: hovered ? `0 4px 20px ${deck.accentColor}44` : 'none',
                }}
              >
                View Deck <ChevronRight size={14} />
              </Link>
            )}
            <button
              onClick={(e) => { e.preventDefault(); setShowQuick(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium
                border border-white/10 text-gray-400 hover:text-white hover:border-white/20
                transition-all duration-200"
            >
              <Zap size={12} /> Quick Strategy
            </button>
          </div>
        </div>

        {/* Hover glow border — only for non-premium (premium uses fire animation) */}
        {!isPremium && (
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
            style={{
              opacity: hovered ? 1 : 0,
              boxShadow: `inset 0 0 0 1px ${deck.accentColor}55`,
            }}
          />
        )}
      </motion.div>

      {/* Quick Strategy Modal */}
      <AnimatePresence>
        {showQuick && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowQuick(false)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative z-10 max-w-md w-full rounded-2xl border border-white/10 glass p-6"
              onClick={e => e.stopPropagation()}
              style={{ borderColor: `${deck.accentColor}44` }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${deck.accentColor}22` }}>
                  <Zap size={18} style={{ color: deck.accentColor }} />
                </div>
                <div>
                  <div className="font-display font-bold text-white">{deck.name}</div>
                  <div className="text-xs text-gray-500">Quick Strategy</div>
                </div>
              </div>

              <p className="text-sm text-gray-300 mb-4 leading-relaxed">{deck.strategy}</p>

              <div className="space-y-2 mb-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Playstyles</div>
                <div className="flex flex-wrap gap-2">
                  {deck.playstyles.map(tag => (
                    <div key={tag} className="text-xs">
                      <span className="font-semibold" style={{ color: deck.accentColor }}>{tag}:</span>{' '}
                      <span className="text-gray-400">{QUICK_STRATEGY_TIPS[tag] || ''}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Link
                  to={`/deck/${deck.slug ?? deck.id}`}
                  className="flex-1 text-center py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${deck.accentColor}, ${deck.accentColor}99)` }}
                  onClick={() => setShowQuick(false)}
                >
                  Full Deck Details
                </Link>
                <button
                  onClick={() => setShowQuick(false)}
                  className="px-4 py-2 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
