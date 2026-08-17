export default function SectionHeader({
  label,
  title,
  subtitle,
  align = "center",
  headingLevel = "h2",
}) {
  const isLeft = align === "left";
  const Heading = headingLevel === "h1" ? "h1" : "h2";

  return (
    <div className={`mb-6 md:mb-8 ${isLeft ? "text-left" : "text-center"}`}>
      {label && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#a00000]">
          {label}
        </p>
      )}
      <Heading className="font-han text-2xl font-bold text-gray-900 md:text-3xl">
        {title}
      </Heading>
      {subtitle && (
        <p
          className={`mt-3 max-w-2xl text-sm leading-relaxed text-gray-500 md:text-base ${
            isLeft ? "" : "mx-auto"
          }`}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function SubsectionLabel({ children, className = "" }) {
  return (
    <p
      className={`mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#a00000] ${className}`}
    >
      {children}
    </p>
  );
}
