interface IconProps {
  name: string;
  className?: string;
  size?: number;
  filled?: boolean;
}

export default function Icon({ name, className = '', size = 20, filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-rounded ${className}`}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: filled ? `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24` : `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
    >
      {name}
    </span>
  );
}
