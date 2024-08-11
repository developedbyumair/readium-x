"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { WebTextToSpeechService as WebSpeechTextToSpeechService } from "../lib/tts";
import { toast } from "sonner";
import { fetchFromLocalStorage, updateLocalStorageGroup } from "@/lib/utils";

export const useTTS = () => {
  const [tts, setTts] = useState<WebSpeechTextToSpeechService | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [groupedVoices, setGroupedVoices] = useState<
    Record<string, SpeechSynthesisVoice[]>
  >({});
  const [selectedVoice, setSelectedVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const ttsService = new WebSpeechTextToSpeechService();
    setTts(ttsService);

    const loadVoices = async () => {
      setIsLoading(true);
      const availableVoices = await ttsService.getVoices();
      const groupedAvailableVoices = await ttsService.getGroupedVoices();
      setVoices(availableVoices);
      setGroupedVoices(groupedAvailableVoices);

      // Load saved voice from localStorage
      const savedSettings = fetchFromLocalStorage(
        "readiumx-text-to-speech-settings",
      );
      const savedVoiceName = savedSettings?.browser?.voice;
      const savedRate = savedSettings?.browser?.rate;
      const savedPitch = savedSettings?.browser?.pitch;

      if (savedVoiceName) {
        const savedVoice = availableVoices.find(
          (voice) => voice.name === savedVoiceName,
        );
        if (savedVoice) {
          setSelectedVoice(savedVoice);
        } else {
          setSelectedVoice(availableVoices[0]);
          console.warn(
            `Saved voice "${savedVoiceName}" not found. Using default.`,
          );
        }
      } else {
        setSelectedVoice(availableVoices[0]);
      }

      if (savedRate) {
        setRate(savedRate);
      }

      if (savedPitch) {
        setPitch(savedPitch);
      }

      setIsLoading(false);
    };

    loadVoices();

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playAudio = useCallback(
    async (articleText: string) => {
      if (tts && selectedVoice) {
        try {
          if (sourceNodeRef.current) {
            sourceNodeRef.current.stop();
          }
          const audioBuffer = await tts.speak(
            articleText,
            selectedVoice,
            rate,
            pitch,
          );
          audioContextRef.current = new AudioContext();
          sourceNodeRef.current = audioContextRef.current.createBufferSource();
          sourceNodeRef.current.buffer = audioBuffer;
          sourceNodeRef.current.connect(audioContextRef.current.destination);
          sourceNodeRef.current.start();
          setIsPlaying(true);

          sourceNodeRef.current.onended = () => {
            setIsPlaying(false);
          };
        } catch (error) {
          if (error instanceof Error) {
            toast.error(`${error.message}`);
          } else {
            toast.error("An error occurred while reading the article");
          }
          setIsPlaying(false);
        }
      }
    },
    [tts, selectedVoice, rate, pitch],
  );

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      setIsPlaying(false);
    }
  }, []);

  const togglePlayPause = useCallback(
    (articleText: string) => {
      setIsPlaying((prevIsPlaying) => {
        if (prevIsPlaying) {
          stopAudio();
          return false;
        } else {
          playAudio(articleText);
          return true;
        }
      });
    },
    [stopAudio, playAudio],
  );

  const updateRate = useCallback((newRate: number) => {
    setRate(newRate);
    updateLocalStorageGroup(
      "text-to-speech-settings",
      "browser",
      "rate",
      newRate.toString(),
    );
  }, []);

  const updatePitch = useCallback((newPitch: number) => {
    setPitch(newPitch);
    updateLocalStorageGroup(
      "text-to-speech-settings",
      "browser",
      "pitch",
      newPitch.toString(),
    );
  }, []);

  return {
    tts,
    voices,
    groupedVoices,
    selectedVoice,
    setSelectedVoice,
    isLoading,
    isPlaying,
    playAudio,
    stopAudio,
    togglePlayPause,
    updateRate,
    updatePitch,
  };
};
