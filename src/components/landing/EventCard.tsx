import React, { useState } from "react";
import { Calendar, Sparkles, Maximize2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { buildImageUrl } from "@/utils/imageUtils";

interface EventCardProps {
    event: any;
    eventDate: Date;
    isToday: boolean;
    isThisWeek: boolean;
    isPast: boolean;
    onImageClick: (event: any) => void;
}

const EventCard: React.FC<EventCardProps> = ({ event, eventDate, isToday, isThisWeek, isPast, onImageClick }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);

    const imageUrl = buildImageUrl(event.image_url);

    return (
        <Card
            className="group hover:shadow-2xl transition-all duration-500 border border-border/50 hover:border-primary/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer h-full flex flex-col"
            onClick={() => onImageClick(event)}
        >
            <div className={`h-1.5 ${isToday
                ? 'bg-gradient-to-r from-primary via-primary/80 to-primary/60'
                : isThisWeek
                    ? 'bg-gradient-to-r from-secondary via-secondary/80 to-secondary/60'
                    : 'bg-gradient-to-r from-muted-foreground/30 via-muted-foreground/20 to-muted-foreground/10'
                }`}></div>
            <div className="w-full h-56 overflow-hidden bg-muted/20 relative">
                {imageUrl && !imageError ? (
                    <>
                        {imageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center z-20 bg-muted/10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        )}
                        <img
                            src={imageUrl}
                            alt={event.title}
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                            onLoad={() => setImageLoading(false)}
                            onError={() => {
                                setImageLoading(false);
                                setImageError(true);
                            }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                        <div className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-10">
                            <Maximize2 className="w-4 h-4" />
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 overflow-hidden [perspective:1000px]">
                        <div className="relative transform-gpu transition-all duration-700 [transform-style:preserve-3d] group-hover:[transform:rotateY(15deg)_rotateX(5deg)] shadow-2xl rounded-full">
                            <img
                                src="/images/Picsart_23-05-18_16-47-20-287-removebg-preview.png"
                                alt="SM Volunteers"
                                className="w-32 h-32 object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.3)] opacity-90"
                            />
                            {/* 3D Reflection Effect */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                        </div>
                        <div className="mt-6 flex flex-col items-center gap-1 relative z-10 translate-z-10">
                            <div className="flex items-center gap-2 px-3 py-1 bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm rounded-full border border-border/10 shadow-sm">
                                <Calendar className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500 dark:text-slate-400">SM Volunteers</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <CardHeader className="pb-3 flex-grow">
                <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
                        {event.title}
                    </CardTitle>
                    <div className="flex flex-col items-end gap-1">
                        {isToday && (
                            <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full uppercase tracking-wider animate-pulse">
                                Today
                            </span>
                        )}
                        {isPast && !isToday && (
                            <span className="px-2.5 py-1 bg-muted text-muted-foreground text-[10px] font-bold rounded-full uppercase tracking-wider">
                                Expired
                            </span>
                        )}
                    </div>
                </div>
                <CardDescription className="flex items-center gap-2 mt-2">
                    <span className="p-1 bg-primary/10 rounded-md">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                    </span>
                    <span className="font-bold text-primary text-sm">
                        {format(eventDate, "MMM dd, yyyy")}
                    </span>
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                        {event.description}
                    </p>
                )}
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-auto">
                    <Sparkles className="w-3 h-3 text-primary/60" />
                    <span>Year: {event.year}</span>
                </div>
            </CardContent>
        </Card>
    );
};

export default React.memo(EventCard);
