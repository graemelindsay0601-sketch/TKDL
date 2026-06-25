/**
 * CardImage Component
 * Extracts individual cards from composite grid images using CSS background-position
 * 
 * Grid structure:
 * - X01 Good/Bad: 5 columns × 4 rows = 20 cards per grid
 * - Cricket Good/Bad: 5 columns × 4 rows = 20 cards per grid
 * - Wildcard Good/Bad: 5 columns × 2 rows = 10 cards per grid
 */

interface CardImageProps {
  card: {
    name: string;
    gameMode: string;  // X01, CRICKET, WILDCARD
    cardType: string;  // GOOD, BAD
    cardId?: string;
  };
  size?: "small" | "medium" | "large";  // 80px, 120px, 180px
}

export function CardImage({ card, size = "medium" }: CardImageProps) {
  const sizeMap = {
    small: 80,
    medium: 120,
    large: 180,
  };

  const width = sizeMap[size];
  const height = (width * 3) / 2; // 2:3 aspect ratio (card aspect)

  // Determine grid image URL
  const getGridImage = (): string => {
    const gameMode = card.gameMode.toUpperCase();
    const cardType = card.cardType.toUpperCase();

    if (gameMode === "X01") {
      return cardType === "GOOD" ? "/cards/x01-good-grid.png" : "/cards/x01-bad-grid.png";
    } else if (gameMode === "CRICKET") {
      return cardType === "GOOD" ? "/cards/cricket-good-grid.png" : "/cards/cricket-bad-grid.png";
    } else if (gameMode === "WILDCARD") {
      return cardType === "GOOD" ? "/cards/wildcard-good-grid.png" : "/cards/wildcard-bad-grid.png";
    }
    return "/cards/card-back.png";
  };

  // Calculate card position in grid (0-indexed)
  const getCardPosition = (): { col: number; row: number } => {
    // Extract card number from name (e.g., "X01 Good 1" -> 0)
    // Or use a hash of the card name to determine position
    const hash = card.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    const gameMode = card.gameMode.toUpperCase();
    const cardType = card.cardType.toUpperCase();
    
    // Determine max rows based on type
    const maxCols = 5;
    const maxRows = gameMode === "WILDCARD" ? 2 : 4;
    const maxCards = maxCols * maxRows;
    
    const index = hash % maxCards;
    return {
      col: index % maxCols,
      row: Math.floor(index / maxCols),
    };
  };

  const position = getCardPosition();
  const gridImage = getGridImage();

  // Calculate background-position percentages
  // Each column is 20% wide, each row is 25% (or 50% for wildcard)
  const gameMode = card.gameMode.toUpperCase();
  const isWildcard = gameMode === "WILDCARD";
  const rowPercent = isWildcard ? 50 : 25;
  
  const bgPosX = (position.col * 20);
  const bgPosY = (position.row * rowPercent);
  const bgSizeX = 500; // 5 columns = 500%
  const bgSizeY = isWildcard ? 200 : 400; // 2 or 4 rows = 200% or 400%

  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundImage: `url('${gridImage}')`,
        backgroundPosition: `${bgPosX}% ${bgPosY}%`,
        backgroundSize: `${bgSizeX}% ${bgSizeY}%`,
        backgroundRepeat: "no-repeat",
        borderRadius: "8px",
        border: "2px solid rgba(255,255,255,0.2)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "scale(1.05) translateY(-2px)";
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = "scale(1) translateY(0)";
        el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)";
      }}
      title={card.name}
    />
  );
}

/**
 * CardImageWithSpinner - Card with 3D rotation animation
 */
interface CardImageWithSpinnerProps extends CardImageProps {
  isActive?: boolean;
}

export function CardImageWithSpinner({ card, size = "medium", isActive = false }: CardImageWithSpinnerProps) {
  return (
    <div
      style={{
        perspective: "1000px",
      }}
    >
      <div
        style={{
          transition: "transform 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
          transformStyle: "preserve-3d",
          transform: isActive ? "rotateY(360deg)" : "rotateY(0deg)",
        }}
      >
        <CardImage card={card} size={size} />
      </div>
    </div>
  );
}
