<script setup lang="ts">
import { onMounted, ref } from 'vue';

const hoveredItemIndex = ref<number | null>(null);
const hoveredIndex = ref<number | null>(null);
const openedDetailIndex = ref<number | null>(null);
const currentPage = ref(1);
const totalPages = ref(1);

interface MusicItem {
    type: string;
    model?: string;
    prompt?: string | null;
    style?: string | null;
    audioUrl?: string;
    imageUrl?: string;
    duration?: number;
    time: string;
    tags?: string;
    title?: string;
    status: string;
    callBackUrl: string | null;
    errorMessage: string | null;
    errorCode: string | null;
}

const musicItems = ref<MusicItem[]>([]);
const currentTimes = ref<number[]>([]);
const durations = ref<number[]>([]);
const downloadingIndex = ref<number | null>(null);
const playingIndex = ref<number | null>(null);
const audioRefs = ref<HTMLAudioElement[]>([]);

async function getMusic(page = 1) {
    const visitor_id = 'P3rxmekLjoQfNCa07Z7e';
    try {
        const BASEURL = import.meta.env.VITE_BASEURL_CHEAT;
        const response = await fetch(`${BASEURL}/get/response/data/${visitor_id}?page=${page}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const results = await response.json();
        // Save pagination metadata
        currentPage.value = results.current_page;
        totalPages.value = results.last_page;

        const items = (Array.isArray(results.data) ? results.data : []).flatMap((item: any) => {

            const data = item?.response?.data;
            const sunoData = data?.response?.sunoData;
            let callBackUrl = null;
            let prompt = null;
            let style = null;

            try {
                const parsedParam = JSON.parse(data?.param || '{}');
                callBackUrl = parsedParam.callBackUrl || null;
                prompt = parsedParam.prompt || null;
                style = parsedParam.style || null;
            } catch (e) {
                console.warn('Invalid JSON in param:', data?.param);
            }

            if (Array.isArray(sunoData)) {
                return sunoData.map((song: any) => ({
                    type: data.operationType,
                    model: song.modelName,
                    audioUrl: song.audioUrl,
                    imageUrl: song.imageUrl,
                    duration: song.duration,
                    time: new Date(song.createTime).toLocaleString(),
                    tags: song.tags,
                    title: song.title,
                    status: data.status,
                    callBackUrl: callBackUrl,
                    prompt: prompt,
                    style: style,
                    errorMessage: data.errorMessage,
                    errorCode: data.errorCode,
                }));
            }

            return [{
                type: data.operationType,
                time: new Date(data.createTime).toLocaleString(),
                status: data.status,
                callBackUrl: callBackUrl,
                errorMessage: data.errorMessage,
                errorCode: data.errorCode,
            }];
        });

        musicItems.value = items;

    } catch (error) {
        console.error('Failed to fetch music:', error);
        musicItems.value = [];
    }
}

function forceDownload(url: string, filename: string, index: number) {
    downloadingIndex.value = index;

    fetch(url, { mode: 'cors' })
        .then(response => response.blob())
        .then(blob => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
        })
        .catch(error => {
            console.error('Download failed:', error);
            alert('Download failed.');
        })
        .finally(() => {
            downloadingIndex.value = null;
        });
}

const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

const setAudioRef = (el: HTMLAudioElement | null, index: number) => {
    if (el) {
        audioRefs.value[index] = el;

        el.addEventListener('timeupdate', () => {
            currentTimes.value[index] = el.currentTime;
        });

        el.addEventListener('loadedmetadata', () => {
            durations.value[index] = el.duration;
        });

        el.addEventListener('ended', () => {
            if (playingIndex.value === index) {
                playingIndex.value = null;
            }
        });
    }
};

const togglePlay = (index: number) => {
    const audio = audioRefs.value[index];
    if (!audio) return;

    if (playingIndex.value === index) {
        audio.pause();
        playingIndex.value = null;
    } else {
        // Pause others
        audioRefs.value.forEach((a, i) => {
            if (i !== index && !a.paused) a.pause();
        });

        audio.play();
        playingIndex.value = index;
    }
};

function formatPrompt(prompt?: string | null): string[] {
  if (!prompt) return [];
  return prompt.split(/[,\.]/g); // split on commas or periods
}

onMounted(() => {
    getMusic();
});
</script>




<template>
    <div class="bg-gray-50 dark:bg-[#18181c] p-4 space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" v-if="musicItems && musicItems.length">
            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800">
                    <tr>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Time</th>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Type</th>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Model</th>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Prompt</th>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Status</th>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Credits Consumed</th>
                        <th scope="col"
                            class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Result</th>
                    </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    <!-- Rejected row -->
                    <tr v-for="(item, index) in musicItems" :key="item.time">
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ item.time }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ item.type }}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{{ item.model
                            || '-' }}</td>
                        <td class="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                            <div v-if="item?.title || item?.prompt || item?.callBackUrl || item?.style"
                                class="dark:bg-[#222936FF] rounded-lg px-3 py-2">
                                <div v-if="item?.title">
                                    <span class="font-semibold">title: </span> {{ item.title }}<br />
                                </div>
                                <div v-if="item?.style">
                                    <span class="font-semibold">style: </span> {{ item.style }}<br />
                                </div>
                                <div v-if="item?.prompt">
                                    <span class="font-semibold" v-if="item?.prompt">
                                        prompt:
                                    </span>
                                    {{ item.prompt.split(' ').slice(0, 6).join(' ') }}...<br />
                                </div>
                                <div v-if="item?.callBackUrl">
                                    <span class="font-semibold" v-if="item?.callBackUrl">callBackUrl: </span> {{
                                        item.callBackUrl }}
                                </div>
                            </div>
                        </td>
                        <td class="text-center relative whitespace-normal text-small font-normal 
                            [&>*]:z-1 [&>*]:relative outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 
                            data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 before:content-[''] 
                            before:absolute before:z-0 before:inset-0 before:opacity-0 data-[selected=true]:before:opacity-100 
                            group-data-[disabled=true]/tr:text-foreground-300 group-data-[disabled=true]/tr:cursor-not-allowed 
                            data-[selected=true]:text-default-foreground first:before:rounded-s-lg last:before:rounded-e-lg 
                            before:bg-transparent px-4 py-2 text-center align-middle"
                            :class="item.status === 'SUCCESS' ? 'text-green-500' : 'text-red-500 dark:text-red-300'">
                            <div class="flex justify-center">
                                <div v-if="item.status == 'SUCCESS'"
                                    class="dark:bg-[#222936FF]  dark:text-gray-300 flex w-fit items-center justify-center gap-[2px] rounded-lg bg-default-100 px-3 py-2">
                                    <svg fill="none" class="me-1" height="7" viewBox="0 0 7 7" width="7"
                                        xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="3.5" cy="3.5" fill="#17C964" r="3.5"></circle>
                                    </svg>
                                    {{ item.status }}
                                </div>
                                <div v-else @mouseenter="hoveredItemIndex = index" @mouseleave="hoveredItemIndex = null"
                                    class="dark:bg-[#222936FF]  dark:text-gray-300 flex w-fit items-center justify-center gap-[2px] rounded-lg bg-default-100 px-3 py-2">
                                    <svg fill="none" height="7" class="me-1" viewBox="0 0 7 7" width="7"
                                        xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="3.5" cy="3.5" fill="#F31260" r="3.5">
                                        </circle>
                                    </svg>
                                    {{ item.status }}
                                    <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
                                        aria-hidden="true" role="img"
                                        class="iconify iconify--solar ms-1 h-4 w-4 text-[#F31260]" width="1em"
                                        height="1em" viewBox="0 0 24 24">
                                        <path fill="currentColor" fill-rule="evenodd"
                                            d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12s4.477 10 10 10s10-4.477 10-10M12 6.25a.75.75 0 0 1 .75.75v6a.75.75 0 0 1-1.5 0V7a.75.75 0 0 1 .75-.75M12 17a1 1 0 1 0 0-2a1 1 0 0 0 0 2"
                                            clip-rule="evenodd">
                                        </path>
                                    </svg>
                                </div>
                                <div v-if="hoveredItemIndex === index" class="absolute top-0 mr-3 z-50 right-full">
                                    <div class="rounded-lg p-4 text-sm bg-white dark:bg-[#222936] shadow-lg text-start">
                                        <div>
                                            <span class="font-medium text-[#eceaea]">Error Code : </span> <span
                                                class="text-red-500 font-normal ms-1"> {{ item.errorCode }}</span><br />
                                        </div>
                                        <div class="text-nowrap">
                                            <span class="font-medium text-[#eceaea]">Error Message : </span> <span
                                                class="text-red-500 font-normal ms-1"> {{ item.errorMessage
                                                }}</span><br />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">-</td>
                        <td class="relative px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                            <div class="inline-block relative" @mouseenter="hoveredIndex = index"
                                @mouseleave="hoveredIndex = null">
                                <!-- Result Button -->
                                <div v-if="item.status === 'SUCCESS'"
                                    class="dark:bg-[#222936FF] flex w-fit items-center justify-center gap-[2px] rounded-lg bg-default-100 px-3 py-2 cursor-pointer">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                        stroke-linejoin="round" class="lucide lucide-music h-4 w-4 me-1">
                                        <path d="M9 18V5l12-2v13"></path>
                                        <circle cx="6" cy="18" r="3"></circle>
                                        <circle cx="18" cy="16" r="3"></circle>
                                    </svg>
                                    Result
                                </div>

                                <!-- Hover Box (Only show when this row is hovered) -->
                                <div v-if="hoveredIndex === index"
                                    class="absolute top-1/2 -translate-y-1/2 mr-3 z-50 right-full w-96">
                                    <div class="rounded-lg p-4 text-sm bg-white dark:bg-[#222936] shadow-lg">
                                        <div class="flex gap-4">
                                            <div class="w-20 aspect-square overflow-hidden rounded-lg">
                                                <img :src="item.imageUrl" alt="Artwork"
                                                    class="h-full w-full object-cover" />
                                            </div>
                                            <div class="flex-1 flex flex-col gap-1">
                                                <h3 class="font-medium">{{ item.title }}</h3>
                                                <div class="flex flex-wrap gap-1">
                                                    <span v-for="(tag, tagIndex) in String(item.tags || '').split(',')"
                                                        :key="tagIndex"
                                                        class="inline-block rounded-full dark:bg-[rgb(49,60,77)] py-1 px-2 text-x text-[rgb(55,58,226)]">
                                                        {{ tag.trim() }}
                                                    </span>
                                                </div>
                                                <div class="flex gap-2 mt-2">
                                                    <button type="button"
                                                        @click="openedDetailIndex === index ? openedDetailIndex = null : openedDetailIndex = index"
                                                        class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                            stroke-width="2" stroke-linecap="round"
                                                            stroke-linejoin="round" class="mr-1">
                                                            <circle cx="8" cy="18" r="4"></circle>
                                                            <path d="M12 18V2l7 4"></path>
                                                        </svg>
                                                        Detail
                                                    </button>
                                                    <button
                                                        @click="forceDownload(item.audioUrl, `${item.title || 'music'}.mp3`, index)"
                                                        class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-gray-600 text-gray-100 hover:bg-gray-700">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                                            viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                            stroke-width="2" stroke-linecap="round"
                                                            stroke-linejoin="round" class="mr-1">
                                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                            <polyline points="7 10 12 15 17 10"></polyline>
                                                            <line x1="12" x2="12" y1="15" y2="3"></line>
                                                        </svg>
                                                        <span>{{ downloadingIndex === index ? 'Downloading...' :
                                                            'Download' }}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="openedDetailIndex === index" class="mt-4 flex w-full flex-col gap-4">
                                            <div class="mt-4 flex w-full flex-col gap-4">
                                                <audio :src="item.audioUrl" :ref="el => setAudioRef(el, index)"></audio>
                                                <div class="flex flex-col gap-2 px-2">
                                                    <div class="flex items-center justify-between">
                                                        <span class="text-sm text-default-500">
                                                            {{ formatTime(currentTimes[index] || 0) }}
                                                        </span>
                                                        <div class="flex items-center gap-2">
                                                            <button type="button" @click="togglePlay(index)">
                                                                <svg v-if="playingIndex === index" xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                                                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                                                    class="lucide h-4 w-4">
                                                                    <!-- Pause Icon -->
                                                                    <rect x="6" y="4" width="4" height="16" />
                                                                    <rect x="14" y="4" width="4" height="16" />
                                                                </svg>

                                                                <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                                                                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                                                    class="lucide h-4 w-4">
                                                                    <!-- Play Icon -->
                                                                    <polygon points="6 3 20 12 6 21 6 3" />
                                                                </svg>
                                                            </button>

                                                        </div>
                                                        <span class="text-sm text-default-500">
                                                            {{ formatTime(durations[index] || item.duration || 0) }}
                                                        </span>
                                                    </div>
                                                    <div data-orientation="horizontal" data-slot="base"
                                                        data-hover="false" class="flex flex-col w-full gap-1 max-w-full"
                                                        role="group" id="react-aria5773708669-:r81:">
                                                        <div data-slot="track-wrapper"
                                                            class="relative flex gap-2 items-center">
                                                            <div data-slot="track" data-thumb-hidden="false"
                                                                data-vertical="false"
                                                                class="flex w-full relative rounded-full border-x-transparent h-1 my-[calc((theme(spacing.5)-theme(spacing.1))/2)] border-x-[calc(theme(spacing.5)/2)] border-s-primary bg-default-500/30"
                                                                style="position: relative; touch-action: none;">
                                                                <div data-slot="filler"
                                                                    class="h-full absolute bg-primary"
                                                                    style="left: 0%; width: 0%;"></div>
                                                                <div data-slot="thumb" orientation="horizontal"
                                                                    class="flex justify-center items-center before:absolute before:w-11 before:h-11 before:rounded-full after:shadow-small after:bg-background data-[focused=true]:z-10 outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 w-5 h-5 after:w-4 after:h-4 rounded-full after:rounded-full top-1/2 cursor-grab data-[dragging=true]:cursor-grabbing ring-transparent border-0 after:transition-all motion-reduce:after:transition-none data-[dragging=true]:after:scale-80 shadow-small bg-primary"
                                                                    index="0"
                                                                    style="position: absolute; left: 0%; transform: translate(-50%, -50%); touch-action: none;">
                                                                    <div
                                                                        style="border: 0px; clip: rect(0px, 0px, 0px, 0px); clip-path: inset(50%); height: 1px; margin: -1px; overflow: hidden; padding: 0px; position: absolute; width: 1px; white-space: nowrap;">
                                                                        <input tabindex="0"
                                                                            id="react-aria5773708669-:r81:-0"
                                                                            aria-labelledby="react-aria5773708669-:r81:"
                                                                            type="range" min="0" max="480" step="1"
                                                                            aria-orientation="horizontal"
                                                                            aria-valuetext="0" aria-describedby=""
                                                                            aria-details="" value="0">
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="flex flex-col relative overflow-hidden h-auto text-foreground box-border bg-content1 outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 shadow-medium rounded-large transition-transform-background motion-reduce:transition-none mt-4"
                                                    tabindex="-1">
                                                    <div
                                                        class="relative flex w-full flex-auto flex-col place-content-inherit align-items-inherit h-auto break-words text-left subpixel-antialiased max-h-40 overflow-y-auto p-4">
                                                        <p class="py-1 transition-colors font-medium text-primary">
                                                            [Verse]</p>
                                                       <p
                                                            v-for="(line, idx) in formatPrompt(item.prompt)"
                                                            :key="idx"
                                                            class="py-1 transition-colors text-default-600"
                                                        >
                                                            {{ line.trim() }}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="flex flex-col items-center justify-between gap-2 px-2 py-2 sm:flex-row">
                <nav role="navigation" aria-label="pagination navigation" data-slot="base" data-controls="true"
                    data-dots-jump="5" data-total="4" data-active-page="1"
                    class="p-2.5 -m-2.5 overflow-x-scroll scrollbar-hide">
                    <ul data-slot="wrapper"
                        class="flex flex-nowrap h-fit max-w-fit relative items-center overflow-visible gap-0 shadow-sm rounded-medium">
                        
                        <li role="button" tabindex="0" aria-label="previous page button"
                            :aria-disabled="currentPage == 1"
                            :data-disabled="currentPage == 1" data-slot="prev"
                            @click="currentPage > 1 && getMusic(currentPage - 1)"
                            class="!rounded-e-none flex flex-wrap truncate box-border items-center justify-center text-default-foreground
                            outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus
                            data-[focus-visible=true]:outline-offset-2 data-[disabled=true]:text-default-300 data-[disabled=true]:pointer-events-none
                            shadow-sm bg-default-100 [&amp;[data-hover=true]:not([data-active=true])]:bg-default-200 active:bg-default-300
                            min-w-9 w-9 h-9 text-small rounded-medium">
                            <svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation"
                                viewBox="0 0 24 24" width="1em">
                                <path d="M15.5 19l-7-7 7-7" stroke="currentColor" stroke-linecap="round"
                                    stroke-linejoin="round" stroke-width="1.5"></path>
                            </svg>
                        </li>
                        <li v-for="page in totalPages" :key="page"
                            role="button"
                            tabindex="0"
                            :aria-label="`pagination item ${page}`"
                            :aria-current="currentPage === page ? 'true' : undefined"
                            :data-active="currentPage === page"
                            data-slot="item"
                            @click="getMusic(page)"
                            class="tap-highlight-transparent select-none touch-none first-of-type:rounded-e-none 
                             last-of-type:rounded-s-none [&:not(:first-of-type):not(:last-of-type)]:rounded-none 
                             data-[pressed=true]:scale-[0.97] transition-transform-background flex flex-wrap truncate 
                             box-border items-center justify-center text-default-foreground outline-none data-[focus-visible=true]:z-10 
                             data-[focus-visible=true]:outline-2 data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2
                             data-[disabled=true]:text-default-300 data-[disabled=true]:pointer-events-none shadow-sm bg-default-100
                             [&:not([data-active=true])]:bg-default-200 active:bg-default-300 min-w-9 w-9 h-9
                             text-small rounded-medium relative"
                            :style="{ cursor: currentPage === page ? 'default' : 'pointer' }"
                        >
                            <span v-if="currentPage === page"
                                aria-hidden="true" data-slot="cursor"
                                class="absolute flex overflow-visible items-center justify-center origin-center left-0 select-none 
                                touch-none pointer-events-none z-20 opacity-100 shadow-primary/40 dark:bg-gray-900 text-primary-foreground shadow-md
                                min-w-9 w-9 h-9 text-small rounded-medium"
                                style="transform: scale(1);"
                            >{{ page }}</span>
                            <span v-else>{{ page }}</span>
                        </li>
                      
                        <li
                            role="button"
                            tabindex="0"
                            aria-label="next page button"
                            data-slot="next"
                            @click="currentPage < totalPages && getMusic(currentPage + 1)"
                            :aria-disabled="currentPage === totalPages"
                            :data-disabled="currentPage === totalPages"
                            class="!rounded-s-none flex flex-wrap truncate box-border items-center justify-center text-default-foreground
                                outline-none data-[focus-visible=true]:z-10 data-[focus-visible=true]:outline-2 
                                data-[focus-visible=true]:outline-focus data-[focus-visible=true]:outline-offset-2 
                                data-[disabled=true]:text-default-300 data-[disabled=true]:pointer-events-none shadow-sm 
                                bg-default-100 [&amp;[data-hover=true]:not([data-active=true])]:bg-default-200 active:bg-default-300 
                                min-w-9 w-9 h-9 text-small rounded-medium"
                        >
                            <svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation"
                                viewBox="0 0 24 24" width="1em" class="rotate-180">
                                <path d="M15.5 19l-7-7 7-7" stroke="currentColor" stroke-linecap="round"
                                    stroke-linejoin="round" stroke-width="1.5"></path>
                            </svg>
                        </li>
                    </ul>
                </nav>
            </div>
        </div>
        <div v-else class="text-center text-gray-500 dark:text-gray-400">
            <p>No music history found.</p>
        </div>
    </div>
</template>