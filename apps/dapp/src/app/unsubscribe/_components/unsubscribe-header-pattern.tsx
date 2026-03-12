import Image from 'next/image';

export default function UnsubscribeHeaderPattern() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute bottom-[-117.99%] left-[-6.25%] right-[-8.62%] top-[-119.9%] opacity-40">
        <Image
          fill
          alt=""
          src="/unsubscribe-header-pattern.svg"
          sizes="100vw"
          className="object-fill"
        />
      </div>
    </div>
  );
}
