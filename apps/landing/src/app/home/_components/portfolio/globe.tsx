'use client';

import '@aarsteinmedia/dotlottie-player-light';

export default function Globe() {
  return (
    <div className="w-[19.45rem] sm:w-[35.375rem] xl:w-[40%]">
      <dotlottie-player src="/zivoe-globe.lottie" autoplay="" subframe="" loop="" />
    </div>
  );
}
