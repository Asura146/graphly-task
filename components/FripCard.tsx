"use client";

import { useState } from "react";

interface FlipCardProps {
    frontContent: React.ReactNode;
    backContent: React.ReactNode;
    width?: string;
    height?: string;
}

export default function FlipCard({
    frontContent,
    backContent,
    width = "300px",
    height = "200px",
}: FlipCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    return (
        <div
            className="group perspective-1000 cursor-pointer"
            style={{ width, height }}
            onClick={handleFlip}
        >
            <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                    isFlipped ? "rotate-y-180" : ""
                }`}
            >
                {/* 表面 */}
                <div className="absolute w-full h-full backface-hidden bg-white rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center items-center">
                    {frontContent}
                </div>

                {/* 裏面 */}
                <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-gray-50 rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col justify-center items-center">
                    {backContent}
                </div>
            </div>

            {/* カスタムstyle */}
            <style jsx global>{`
                .perspective-1000 {
                    perspective: 1000px;
                }
                .transform-style-3d {
                    transform-style: preserve-3d;
                }
                .backface-hidden {
                    backface-visibility: hidden;
                }
                .rotate-y-180 {
                    transform: rotateY(180deg);
                }
            `}</style>
        </div>
    );
}