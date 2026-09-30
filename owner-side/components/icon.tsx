type IconProps = {
  name: string;
  className?: string;
  fill?: boolean;
};

export function Icon({ name, className = "", fill = false }: IconProps) {
  return (
    <span
      aria-hidden
      className={`ms-outlined ${fill ? "ms-outlined-fill" : ""} ${className}`}
    >
      {name}
    </span>
  );
}
