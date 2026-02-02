"use client";

import { useState } from "react";

interface FlipCardProps {
    frontTopHeader?: React.ReactNode;    // 上段の最上部ヘッダー（色帯など）
    frontTopContent: React.ReactNode;    // 表面・上側のメインコンテンツ
    frontBottomContent: React.ReactNode; // 表面・下側のコンテンツ
    backContent: React.ReactNode;
    width?: string;
    height?: string;
}

export default function FlipCard({
    frontTopHeader,
    frontTopContent,
    frontBottomContent,
    backContent,
    width = "300px",
    height = "400px",
}: FlipCardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsFlipped(!isFlipped);
    };

    // ミシン目
    const PerforationLine = () => (
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-gray-400 z-20 pointer-events-none" />
    );

    // 反転ボタン
    const FlipButton = () => (
        <button 
            onClick={handleFlip}
            className="absolute bottom-3 right-3 z-50 p-2 rounded-full bg-white/90 shadow-sm border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
            </svg>
        </button>
    );

    const maskClass = "ticket-mask";

    return (
        <div
            className="group perspective-1000"
            style={{ width, height }}
        >
            <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                    isFlipped ? "rotate-y-180" : ""
                }`}
            >
                {/* 表面 */}
                <div className={`absolute w-full h-full backface-hidden bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden ${maskClass}`}>
                    <PerforationLine />
                    <FlipButton />
                    
                    {/* 上段セクション*/}
                    <div className="flex-1 w-full flex flex-col">
                        {/* ヘッダー部分*/}
                        {frontTopHeader && (
                            <div className="w-full relative z-10">
                                {frontTopHeader}
                            </div>
                        )}
                        
                        {/* メインコンテンツ部分 */}
                        <div className="flex-1 w-full flex flex-col z-10">
                            {frontTopContent}
                        </div>
                    </div>

                    {/* 下段セクション */}
                    <div className="flex-1 w-full flex flex-col justify-center items-center text-center relative z-10">
                        {frontBottomContent}
                    </div>
                </div>

                {/* 裏面 */}
                <div className={`absolute w-full h-full backface-hidden rotate-y-180 bg-gray-800 rounded-xl shadow-lg border border-gray-200 p-6 flex flex-col overflow-hidden ${maskClass}`}>
                    <FlipButton />
                    {backContent}
                </div>
            </div>

            <style jsx global>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }

                .ticket-mask {
                    -webkit-mask-image: 
                        radial-gradient(circle at 0% 50%, transparent 12px, black 13px),
                        radial-gradient(circle at 100% 50%, transparent 12px, black 13px);
                    -webkit-mask-composite: source-in;
                    mask-composite: intersect;
                }
            `}</style>
        </div>
    );
}