import React, { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export function NumberTicker({ value, className }) {
  const strVal = String(value ?? 0);
  const match = strVal.match(/[-+]?[0-9]*\.?[0-9]+/);
  const num = match ? parseFloat(match[0]) : 0;
  const suffix = match ? strVal.slice(match.index + match[0].length) : "";

  const spring = useSpring(0, { bounce: 0, duration: 800 });
  const display = useTransform(spring, (current) => {
    const rounded = Math.round(current);
    return `${rounded.toLocaleString()}${suffix}`;
  });

  useEffect(() => {
    spring.set(num);
  }, [spring, num]);

  return <motion.span className={className}>{display}</motion.span>;
}
