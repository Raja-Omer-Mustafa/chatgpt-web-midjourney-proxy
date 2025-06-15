<script setup>
    import { ref, onMounted, onBeforeUnmount } from 'vue';
    import { sunoStore} from '@/api/sunoStore';
    import {computed } from 'vue'; 

    const progressBarPercent = ref(0);
    let progressInterval = null;

    const progressBarPercentage = () => {
        // Reset if already running
        if (progressInterval) clearInterval(progressInterval);
        progressBarPercent.value = 0;
        const targetPercent = 97;
        const duration = 40; // seconds
        const intervalMs = 500; // update every 0.5s
        const step = targetPercent / (duration * 1000 / intervalMs);
        progressInterval = setInterval(() => {
            if (progressBarPercent.value < targetPercent) {
                progressBarPercent.value = Math.min(progressBarPercent.value + step, targetPercent);
            } else {
                clearInterval(progressInterval);
                progressInterval = null;
            }
        }, intervalMs);
    };

    onMounted(() => {
        progressBarPercentage();
    });

    onBeforeUnmount(() => {
        if (progressInterval) clearInterval(progressInterval);
    });
</script>

<template>
    <div class="flex flex-col items-center justify-start min-h-[60vh] mx-auto">
        <div class="w-full lg:w-7/12">
            <div class="bg-zinc-900 rounded-xl p-6">
                <!-- Loader/Skeleton while waiting for API response -->
                <div class="task-status PENDING" :class="taskClass">
                    <!-- Skeleton UI for track preview -->
                    <div class="mt-7">
                        <div class="flex items-center gap-5">
                            <div
                                class="w-20 h-20 bg-zinc-800 rounded-lg animate-pulse">
                            </div>
                            <div class="flex-1">
                                <div
                                    class="h-4 w-3/5 bg-zinc-800 rounded-md mb-2.5 animate-pulse">
                                </div>
                                <div
                                    class="h-3.5 w-2/5 bg-zinc-800 rounded-md mb-2 animate-pulse">
                                </div>
                                <div
                                    class="h-3 w-1/3 bg-zinc-800 rounded-md animate-pulse">
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- Progress Bar -->
                </div>
            </div>
            <div class="w-full mt-4 h-2.5 bg-zinc-800 rounded-lg">
                <div class="h-full flex items-center pl-2 rounded-lg"
                    role="progressbar"
                    :style="{
                        width: progressBarPercent + '%',
                        background: 'linear-gradient(90deg, #b9a6e8 0%, #6A4FC7 100%)',
                        transition: 'width 0.6s cubic-bezier(.4,2,.6,1)'
                    }"
                    :aria-valuenow="progressBarPercent" aria-valuemin="0" aria-valuemax="100">
                </div>
            </div>
            <div>
                <p  class="text-center mt-1 mb-0 text-violet-700">It takes 20-40 second
                    to generate, please wait patiently</p>
            </div>
        </div>
    </div>
</template>
