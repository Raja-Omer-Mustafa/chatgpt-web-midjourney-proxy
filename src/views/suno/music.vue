<script setup lang="ts">
import { ref } from 'vue';
import McInput from './mcInput.vue';
import mcList from './mcList.vue';
import mcplayer from './mcplayer.vue';
import Skeleton from './loaderSkeleton.vue';
import { NTabs, NTabPane } from "naive-ui"
import udioList from './udioList.vue';
import { gptServerStore } from '@/store';
import { useRoute } from 'vue-router';
import { showLoaderSkeleton } from '@/api/sunoStore';

const route = useRoute(); // 获取当前路由对象
const st = ref({ menu: 'suno', tab: '' });

const handleUpdateValue = (v: string) => {
    //mlog("handleUpdateValue",v)
    gptServerStore.setMyData({ TAB_MUSIC: v })
}

const initLoad = () => {
    if (route.query.tab) {
        st.value.tab = 'suno'
        let tt = (route.query.tab as string).toLocaleLowerCase();
        if (['suno', 'udio'].indexOf(tt) > -1) {
            st.value.tab = tt;
        }

        handleUpdateValue(st.value.tab)
    }
    else st.value.tab = (gptServerStore.myData.TAB_MUSIC ? gptServerStore.myData.TAB_MUSIC : 'suno')
}
initLoad();
</script>

<template>
    <div class="flex flex-col md:flex-row w-full h-full">
        <!-- Tabs on Mobile -->
        <div class="md:hidden w-full border-b dark:border-gray-700">
            <n-tabs type="line" animated size="small" :default-value="gptServerStore.myData.TAB_MUSIC ?? 'suno'"
                @update:value="handleUpdateValue">
                <n-tab-pane name="suno" tab="Cheat">
                    <!-- Show form on mobile inside tab -->
                    <div class="p-3">
                        <McInput />
                    </div>
                </n-tab-pane>
            </n-tabs>
        </div>

        <!-- Sidebar (desktop only) -->
        <div
            class="hidden md:flex md:flex-col md:w-[250px] lg:w-[300px] h-full overflow-y-auto border-r dark:border-gray-700">
            <n-tabs type="line" animated size="medium" :default-value="gptServerStore.myData.TAB_MUSIC ?? 'suno'"
                @update:value="handleUpdateValue">
                <n-tab-pane name="suno" tab="Cheat">
                    <McInput />
                </n-tab-pane>
            </n-tabs>
        </div>

        <!-- Main content -->
        <div class="flex-1 w-full h-full bg-[#fafbfc] dark:bg-[#18181c] overflow-y-auto p-3 md:pt-2">
            <Skeleton v-if="showLoaderSkeleton" class="mx-auto mt-10" />
            <udioList v-if="gptServerStore.myData.TAB_MUSIC == 'udio'" />
            <mcList v-else />
        </div>

        <!-- Right player (desktop only) -->
        <div class="hidden lg:block w-[300px] h-full overflow-y-auto border-l dark:border-gray-700">
            <mcplayer />
        </div>

        <!-- Player on mobile (bottom fixed) -->
        <!-- <div
            class="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#18181c] border-t dark:border-gray-700 shadow-lg">
            <mcplayer />
        </div> -->
    </div>
</template>
