<script setup lang='ts'>
import type { Ref } from "vue";
import { computed, h, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import {
  NAutoComplete,
  NButton,
  NInput,
  useDialog,
  useMessage,
  NAvatar,
} from "naive-ui";
import html2canvas from "html2canvas";
import { Message } from "./components";
import { useScroll } from "./hooks/useScroll";
import { useChat } from "./hooks/useChat";
import { useUsingContext } from "./hooks/useUsingContext";
import HeaderComponent from "./components/Header/index.vue";
import { SvgIcon } from "@/components/common";
import { useBasicLayout } from "@/hooks/useBasicLayout";
import {
  gptConfigStore,
  gptServerStore,
  gptsUlistStore,
  homeStore,
  useChatStore,
  usePromptStore,
} from "@/store";
import {
  chatSetting,
  fetchChatAPIProcess,
  gptsType,
  mlog,
  myFetch,
} from "@/api";
import { t } from "@/locales";
import drawListVue from "../mj/drawList.vue";
import aiGPT from "../mj/aiGpt.vue";
import AiSiderInput from "../mj/aiSiderInput.vue";
import aiGptInput from "../mj/aiGptInput.vue";
import AiTextSetting from "../mj/aiTextSetting.vue";
import { useUserStore } from "@/store";

let controller = new AbortController();

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === "true";

const route = useRoute();
const dialog = useDialog();
const ms = useMessage();
const router = useRouter();
const chatStore = useChatStore();

const { isMobile } = useBasicLayout();
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } =
  useChat();
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll();
const { usingContext, toggleUsingContext } = useUsingContext();

const { uuid } = route.params as { uuid: string };

const dataSources = computed(() => chatStore.getChatByUuid(+uuid));
const conversationList = computed(() =>
  dataSources.value.filter(
    (item) => !item.inversion && !!item.conversationOptions
  )
);

const prompt = ref<string>("");
const loading = ref<boolean>(false);
const inputRef = ref<Ref | null>(null);

// 添加PromptStore
const promptStore = usePromptStore();

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore);

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading) updateChatSome(+uuid, index, { loading: false });
});

const userStore = useUserStore();

const userInfo = computed(() => userStore.userInfo);

const backgroundImage = computed(()=>userInfo.value.backgroundImage ?? "");

function useExample(text: string) {
    prompt.value = text;
            
}

const uploadedFile = ref<any|null>("")
const analysisMode = ref("default") // or whatever mode you use

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  else return (bytes / 1024 / 1024).toFixed(1) + " MB"
}

async function handleFileSelect(event: Event) {
	const target = event.target as HTMLInputElement
	const file = target.files?.[0]
	if (!file) return

	const formData = new FormData()
	formData.append("file", file)
	formData.append("analysis_mode", analysisMode.value)

	try {
		const response = await fetch('https://trunegative.com/api/upload', {
			method: "POST",
			body: formData,
		})

		const data = await response.json()

		if (data.error) {
			throw new Error(data.error)
		}

		uploadedFile.value = data
	} catch (error: any) {
		console.error("Upload error:", error)
		alert(`Failed to upload file: ${error.message}`)
	}

	// clear input so same file can be re-selected
	target.value = ""
}

function removeFile() {
  uploadedFile.value = null
}

function handleSubmit() {
  //onConversation() //把这个放到aiGpt
  let message = prompt.value;
  if (!message || message.trim() === "") return;
  if (loading.value) return;
  loading.value = true;
  homeStore.setMyData({
    act: "gpt.submit",
    actData: { prompt: prompt.value, uuid, uploadedFile: uploadedFile.value.analysis
  },
  });
  prompt.value = "";
}

async function onConversation() {
  let message = prompt.value;

  if (loading.value) return;

  if (!message || message.trim() === "") return;

  controller = new AbortController();

  addChat(+uuid, {
    dateTime: new Date().toLocaleString(),
    text: message,
    inversion: true,
    error: false,
    conversationOptions: null,
    requestOptions: { prompt: message, options: null },
  });
  scrollToBottom();

  loading.value = true;
  prompt.value = "";

  let options: Chat.ConversationRequest = {};
  const lastContext =
    conversationList.value[conversationList.value.length - 1]
      ?.conversationOptions;

  if (lastContext && usingContext.value) options = { ...lastContext };

  addChat(+uuid, {
    dateTime: new Date().toLocaleString(),
    text: "思考中",
    loading: true,
    inversion: false,
    error: false,
    conversationOptions: null,
    requestOptions: { prompt: message, options: { ...options } },
  });
  scrollToBottom();

  try {
    let lastText = "";
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target;
          const { responseText } = xhr;
          // Always process the final line
          const lastIndex = responseText.lastIndexOf(
            "\n",
            responseText.length - 2
          );
          let chunk = responseText;
          if (lastIndex !== -1) chunk = responseText.substring(lastIndex);
          try {
            const data = JSON.parse(chunk);
            updateChat(+uuid, dataSources.value.length - 1, {
              dateTime: new Date().toLocaleString(),
              text: lastText + (data.text ?? ""),
              inversion: false,
              error: false,
              loading: true,
              conversationOptions: {
                conversationId: data.conversationId,
                parentMessageId: data.id,
              },
              requestOptions: { prompt: message, options: { ...options } },
            });

            if (
              openLongReply &&
              data.detail.choices[0].finish_reason === "length"
            ) {
              options.parentMessageId = data.id;
              lastText = data.text;
              message = "";
              return fetchChatAPIOnce();
            }

            scrollToBottomIfAtBottom();
          } catch (error) {
            //
          }
        },
      });
      updateChatSome(+uuid, dataSources.value.length - 1, { loading: false });
    };

    await fetchChatAPIOnce();
  } catch (error: any) {
    const errorMessage = error?.message ?? t("common.wrong");

    if (error.message === "canceled") {
      updateChatSome(+uuid, dataSources.value.length - 1, {
        loading: false,
      });
      scrollToBottomIfAtBottom();
      return;
    }

    const currentChat = getChatByUuidAndIndex(
      +uuid,
      dataSources.value.length - 1
    );

    if (currentChat?.text && currentChat.text !== "") {
      updateChatSome(+uuid, dataSources.value.length - 1, {
        text: `${currentChat.text}\n[${errorMessage}]`,
        error: false,
        loading: false,
      });
      return;
    }

    updateChat(+uuid, dataSources.value.length - 1, {
      dateTime: new Date().toLocaleString(),
      text: errorMessage,
      inversion: false,
      error: true,
      loading: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    });
    scrollToBottomIfAtBottom();
  } finally {
    loading.value = false;
  }
}

async function onRegenerate(index: number) {
  if (loading.value) return;

  controller = new AbortController();

  const { requestOptions } = dataSources.value[index];

  let message = requestOptions?.prompt ?? "";

  let options: Chat.ConversationRequest = {};

  if (requestOptions.options) options = { ...requestOptions.options };

  loading.value = true;

  updateChat(+uuid, index, {
    dateTime: new Date().toLocaleString(),
    text: "",
    inversion: false,
    error: false,
    loading: true,
    conversationOptions: null,
    requestOptions: { prompt: message, options: { ...options } },
  });

  try {
    let lastText = "";
    const fetchChatAPIOnce = async () => {
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        signal: controller.signal,
        onDownloadProgress: ({ event }) => {
          const xhr = event.target;
          const { responseText } = xhr;
          // Always process the final line
          const lastIndex = responseText.lastIndexOf(
            "\n",
            responseText.length - 2
          );
          let chunk = responseText;
          if (lastIndex !== -1) chunk = responseText.substring(lastIndex);
          try {
            const data = JSON.parse(chunk);
            updateChat(+uuid, index, {
              dateTime: new Date().toLocaleString(),
              text: lastText + (data.text ?? ""),
              inversion: false,
              error: false,
              loading: true,
              conversationOptions: {
                conversationId: data.conversationId,
                parentMessageId: data.id,
              },
              requestOptions: { prompt: message, options: { ...options } },
            });

            if (
              openLongReply &&
              data.detail.choices[0].finish_reason === "length"
            ) {
              options.parentMessageId = data.id;
              lastText = data.text;
              message = "";
              return fetchChatAPIOnce();
            }
          } catch (error) {
            //
          }
        },
      });
      updateChatSome(+uuid, index, { loading: false });
    };
    await fetchChatAPIOnce();
  } catch (error: any) {
    if (error.message === "canceled") {
      updateChatSome(+uuid, index, {
        loading: false,
      });
      return;
    }

    const errorMessage = error?.message ?? t("common.wrong");

    updateChat(+uuid, index, {
      dateTime: new Date().toLocaleString(),
      text: errorMessage,
      inversion: false,
      error: true,
      loading: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    });
  } finally {
    loading.value = false;
  }
}

function handleExport() {
  if (loading.value) return;

  const d = dialog.warning({
    title: t("chat.exportImage"),
    content: t("chat.exportImageConfirm"),
    positiveText: t("common.yes"),
    negativeText: t("common.no"),
    onPositiveClick: async () => {
      try {
        d.loading = true;
        const ele = document.getElementById("image-wrapper");
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        });
        const imgUrl = canvas.toDataURL("image/png");
        const tempLink = document.createElement("a");
        tempLink.style.display = "none";
        tempLink.href = imgUrl;
        tempLink.setAttribute("download", "chat-shot.png");
        if (typeof tempLink.download === "undefined")
          tempLink.setAttribute("target", "_blank");

        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        window.URL.revokeObjectURL(imgUrl);
        d.loading = false;
        ms.success(t("chat.exportSuccess"));
        Promise.resolve();
      } catch (error: any) {
        ms.error(t("chat.exportFailed"));
      } finally {
        d.loading = false;
      }
    },
  });
}

function handleDelete(index: number) {
  if (loading.value) return;

  dialog.warning({
    title: t("chat.deleteMessage"),
    content: t("chat.deleteMessageConfirm"),
    positiveText: t("common.yes"),
    negativeText: t("common.no"),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index);
    },
  });
}

function handleEdit(index: number) {
  if (loading.value) return;

  const editedMessage = ref(dataSources.value[index].text.slice());

  const inputNode = () => {
    return h(NInput, {
      value: editedMessage.value,
      type: "textarea",
      autosize: { minRows: 1, maxRows: 8 },
      showCount: true,
      "onUpdate:value": (v: string) => {
        editedMessage.value = v;
      },
    });
  };

  dialog.warning({
    title: t("common.edit"),
    content: inputNode,
    positiveText: t("common.yes"),
    negativeText: t("common.no"),
    onPositiveClick: () => {
      updateChatSome(+uuid, index, { text: editedMessage.value });
    },
  });
}

function handleClear() {
  if (loading.value) return;

  dialog.warning({
    title: t("chat.clearChat"),
    content: t("chat.clearChatConfirm"),
    positiveText: t("common.yes"),
    negativeText: t("common.no"),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid);
    },
  });
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  } else {
    if (event.key === "Enter" && event.ctrlKey) {
      event.preventDefault();
      handleSubmit();
    }
  }
}

function handleStop() {
  if (loading.value) {
    homeStore.setMyData({ act: "abort" });
    controller.abort();
    loading.value = false;
  }
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith("/")) {
    const abc = promptTemplate.value
      .filter((item: { key: string }) =>
        item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())
      )
      .map((obj: { value: any }) => {
        return {
          label: obj.value,
          value: obj.value,
        };
      });
    mlog("搜索选项", abc);
    return abc;
  } else if (prompt.value == "@") {
    const abc = gptsUlistStore.myData.slice(0, 10).map((v: gptsType) => {
      return {
        label: v.info,
        gpts: v,
        value: v.gid,
      };
    });
    return abc;
  } else {
    return [];
  }
});

const goUseGpts = async (item: gptsType) => {
  const saveObj = { model: `${item.gid}`, gpts: item };
  gptConfigStore.setMyData(saveObj);
  if (chatStore.active) {
    //保存到对话框
    const chatSet = new chatSetting(chatStore.active);
    //if( chatSet.findIndex()>-1 ) chatSet.save( saveObj )
    chatSet.save(saveObj);
  }
  ms.success(t("mjchat.success2"));
  const gptUrl = `https://gpts.ddaiai.com/open/gptsapi/use`;
  myFetch(gptUrl, item);

  mlog("go local ", homeStore.myData.local);
  if (homeStore.myData.local !== "Chat")
    router.replace({ name: "Chat", params: { uuid: chatStore.active } });

  gptsUlistStore.setMyData(item);
};

// value反渲染key
const renderOption = (option: { label: string; gpts?: gptsType }) => {
  if (prompt.value == "@") {
    //return [ h( NAvatar,{src:'https://cos.aitutu.cc/gpts/gpt4all.jpg',size:"small",round:true}),option.label ]
    return [
      h(
        "div",
        {
          class: "flex justify-start items-center",
          onclick: () => {
            if (option.gpts) goUseGpts(option.gpts);
            prompt.value = "";
            setTimeout(() => (prompt.value = ""), 80);
          },
        },
        [
          h(NAvatar, {
            src: option.gpts?.logo,
            "fallback-src": "https://cos.aitutu.cc/gpts/3.5net.png",
            size: "small",
            round: true,
            class: "w-8 h-8",
          }),
          h("span", { class: "pl-1" }, option.gpts?.name),
          h(
            "span",
            { class: "line-clamp-1 flex-1 pl-1 opacity-50" },
            option.label
          ),
        ]
      ),
    ];
  }
  for (const i of promptTemplate.value) {
    if (i.value === option.label) return [i.key];
  }
  return [];
};

const placeholder = computed(() => {
  if (isMobile.value) return t("chat.placeholderMobile");
  return t("chat.placeholder");
});

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === "";
});

const footerClass = computed(() => {
  let classes = ["p-4"];
  if (isMobile.value)
    classes = ["sticky", "left-0", "bottom-0", "right-0", "p-2", "pr-3"]; //, 'overflow-hidden'
  return classes;
});

onMounted(() => {
  scrollToBottom();
  if (inputRef.value && !isMobile.value) inputRef.value?.focus();
});

onUnmounted(() => {
  if (loading.value) controller.abort();
  homeStore.setMyData({ isLoader: false });
});

const local = computed(() => homeStore.myData.local);
watch(
  () => homeStore.myData.act,
  (n) => {
    if (n == "draw") scrollToBottom();
    if (n == "scrollToBottom") scrollToBottom();
    if (n == "scrollToBottomIfAtBottom") scrollToBottomIfAtBottom();
    if (n == "gpt.submit" || n == "gpt.resubmit") {
      loading.value = true;
      if (chatStore.active) {
        const chatSet = new chatSetting(chatStore.active);
        if (chatSet.findIndex() == -1) {
          //如果是空保存到对话框
          chatSet.save(chatSet.getGptConfig());
          setTimeout(() => homeStore.setMyData({ act: "saveChat" }), 600);
        }
      }
    }
    if (n == "stopLoading") {
      loading.value = false;
    }
  }
);
const st = ref({ inputme: true });

watch(
  () => loading.value,
  (n) => homeStore.setMyData({ isLoader: n })
);

const ychat = computed(() => {
  let text = prompt.value;
  if (loading.value) text = "";
  else {
    scrollToBottomIfAtBottom();
  }
  return { text, dateTime: t("chat.preview") } as Chat.Chat;
});
</script>

<template>
    <div v-if="backgroundImage"
        class=" fixed z-[200] pointer-events-none top-0 left-0 w-full h-full bg-cover bg-center bg-no-repeat" :style="{
      'background-image': 'url(' + backgroundImage + ')',
      opacity: 0.19,
    }"></div>
    <div class="flex flex-col w-full h-full">
        <!-- v-if="isMobile" -->
        <HeaderComponent :using-context="usingContext" @export="handleExport" @handle-clear="handleClear" />
        <main class="flex-1 overflow-hidden">
            <div id="scrollRef" ref="scrollRef" class="h-full overflow-hidden overflow-y-auto">
                <div id="image-wrapper" class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
                    :class="[isMobile ? 'p-2' : 'p-4']">
                    <template v-if="!(dataSources.length || uploadedFile)" >
                        <!-- <div class="text-center pt-10" v-if="
                            homeStore.myData.isClient &&
                            (!gptServerStore.myData.OPENAI_API_BASE_URL ||
                            !gptServerStore.myData.OPENAI_API_KEY)
                        ">
                            <AiTextSetting />
                        </div>
                        <div v-else-if="homeStore.myData.session.notify" v-html="homeStore.myData.session.notify"
                            class="text-neutral-300 mt-4"></div>
                        <div class="flex items-center justify-center mt-4 text-center text-neutral-300" v-else>
                            <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
                            <span>Aha~</span>
                        </div> -->
                        <div class="welcome-screen">
                            <div class="welcome-content">
                                <div class="welcome-icon">🎵</div>
                                <h1>CHEAT HIT MUSIC MASTER</h1>
                                <p>Your brutal, honest AI music production assistant. Get direct feedback, technical
                                    precision, and hit-making strategies.</p>
                                <div class="example-prompts">
                                    <button @click="useExample('Help me write a catchy hook for a pop song')"
                                        class="example-btn">
                                        Write a catchy hook
                                    </button>
                                    <button @click="useExample('Analyze my lyrics for commercial potential')"
                                        class="example-btn">
                                        Analyze lyrics
                                    </button>
                                    <button @click="useExample('Give me specific mix settings for a modern pop track')"
                                        class="example-btn">
                                        Mix settings advice
                                    </button>
                                    <button @click="useExample('What makes a song go viral on TikTok in 2025?')"
                                        class="example-btn">
                                        Viral song strategies
                                    </button>
                                </div>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div>
							<Message
								v-for="(item, index) of dataSources"
								:key="index"
								:date-time="item.dateTime"
								:text="item.text"
								:inversion="item.inversion"
								:error="item.error"
								:loading="item.loading"
								@regenerate="onRegenerate(index)"
								@delete="handleDelete(index)"
								@edit="handleEdit(index)"
								:chat="{ ...item, model: undefined }"
								:index="index"
							/>
                            <Message v-if="ychat.text" :key="dataSources.length" :inversion="true"
                                :date-time="$t('mj.typing')" :chat="ychat" :text="ychat.text"
                                :index="dataSources.length" />
                            <div class="sticky bottom-0 left-0 flex justify-center">
                                <NButton v-if="loading" type="warning" @click="handleStop">
                                    <template #icon>
                                        <SvgIcon icon="ri:stop-circle-line" />
                                    </template>
                                    {{ t("common.stopResponding") }}
                                </NButton>
                            </div>
							<!-- File status preview -->
							<div v-if="uploadedFile" class="file-status flex items-center space-x-2">
								<span class="text-sm text-gray-300">
									{{ uploadedFile.filename }} ({{ formatFileSize(uploadedFile.size) }})
								</span>
								<button @click="removeFile" class="text-red-400 hover:text-red-600">
									✕
								</button>
							</div>
                        </div>
                    </template>
                </div>
            </div>
        </main>
        <footer :class="footerClass" v-if="local !== 'draw'">
            <div class="w-full max-w-screen-xl m-auto">
                <div class="flex items-center bg-[#2a2a2a] rounded-full px-3 py-2">

                    <!-- Attachment Icon -->
                    	<input 
							type="file" 
							ref="fileInput" 
							style="display: none"
							accept=".txt,.md,.lyrics,.pdf,.wav,.mp3,.flac,.aiff,.docx"
							@change="handleFileSelect"  
						/>

						<!-- Attachment button -->
						<button 
							class="flex items-center justify-center text-gray-400 hover:text-white mr-2"
							@click="$refs.fileInput.click()"
						>
							<SvgIcon icon="ri:attachment-2" class="w-5 h-5" />
						</button>

                    <!-- Input Box -->
                    <NInput ref="inputRef" v-model:value="prompt" type="textarea" :placeholder="placeholder"
                        :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }" @keypress="handleEnterhandleEnter"
                        class="flex-1 bg-transparent border-0 focus:ring-0 text-white resize-none" />

                    <!-- Send Button -->
                    <button class="ml-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] rounded-full p-2" :disabled="buttonDisabled"
                        @click="handleSubmit">
                        <SvgIcon icon="ri:send-plane-fill" class="w-5 h-5 text-white" />
                    </button>
                </div>
            </div>
        </footer>
    </div>

    <drawListVue />
    <aiGPT @finished="loading = false" />
    <AiSiderInput v-if="isMobile" :button-disabled="false" />
</template>
<style>
    /* CHEAT HIT MUSIC MASTER - State-of-the-Art ChatGPT Design */

    /* CSS Reset & Base */
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    html {
        font-size: 16px;
        scroll-behavior: smooth;
    }

    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
        background: #212121;
        color: #ececec;
        line-height: 1.6;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    /* Header */
    .header {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: rgba(33, 33, 33, 0.95);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(86, 88, 105, 0.3);
        padding: 0;
    }

    .header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 768px;
        margin: 0 auto;
        padding: 12px 16px;
        height: 60px;
    }

    .logo {
        font-size: 18px;
        font-weight: 600;
        background: linear-gradient(135deg, #10a37f 0%, #1a7f64 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
    }

    .header-controls {
        display: flex;
        gap: 8px;
        align-items: center;
    }

    /* Main Container */
    .main-container {
        min-height: calc(100vh - 60px);
        display: flex;
        justify-content: center;
        padding: 0;
    }

    /* Chat Area */
    .chat-area {
        width: 100%;
        max-width: 768px;
        display: flex;
        flex-direction: column;
        position: relative;
    }

    /* Welcome Screen */
    .welcome-screen {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        min-height: calc(100vh - 200px);
    }

    .welcome-content {
        text-align: center;
        max-width: 480px;
    }

    .welcome-icon {
        font-size: 48px;
        margin-bottom: 24px;
        opacity: 0.8;
    }

    .welcome-content h1 {
        font-size: 32px;
        font-weight: 600;
        margin-bottom: 16px;
        background: linear-gradient(135deg, #10a37f 0%, #1a7f64 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
    }

    .welcome-content p {
        font-size: 16px;
        color: #b4b4b4;
        margin-bottom: 32px;
        line-height: 1.5;
    }

    .example-prompts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-top: 24px;
    }

    .example-btn {
        background: rgba(47, 47, 47, 0.8);
        border: 1px solid rgba(86, 88, 105, 0.3);
        color: #ececec;
        padding: 16px 20px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        text-align: left;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
    }

    .example-btn:hover {
        background: rgba(47, 47, 47, 1);
        border-color: rgba(16, 163, 127, 0.5);
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }

    /* Chat Messages */
    .chat-messages {
        flex: 1;
        padding: 24px 0;
        min-height: calc(100vh - 200px);
    }

    .message-wrapper {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        padding: 0 16px;
        animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .message-wrapper.user {
        flex-direction: row-reverse;
    }

    .message-avatar {
        flex-shrink: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
    }

    .user-avatar {
        background: linear-gradient(135deg, #10a37f 0%, #0d8f6f 100%);
        color: white;
    }

    .assistant-avatar {
        background: #2f2f2f;
        color: #ececec;
        border: 1px solid rgba(86, 88, 105, 0.3);
    }

    .message-content {
        flex: 1;
        max-width: calc(100% - 48px);
    }

    .message-wrapper.user .message-content {
        text-align: right;
    }

    .message-text {
        background: transparent;
        color: #ececec;
        font-size: 15px;
        line-height: 1.6;
        word-wrap: break-word;
        white-space: pre-wrap;
    }

    .message-wrapper.user .message-text {
        background: linear-gradient(135deg, #10a37f 0%, #0d8f6f 100%);
        color: white;
        padding: 12px 16px;
        border-radius: 18px;
        border-bottom-right-radius: 4px;
        display: inline-block;
        max-width: fit-content;
        margin-left: auto;
    }

    .message-wrapper.assistant .message-text {
        padding: 0;
    }

    /* Typing Indicator */
    .typing-indicator {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: 12px 0;
    }

    .typing-indicator span {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #10a37f;
        animation: typing 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(2) {
        animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
        animation-delay: 0.4s;
    }

    @keyframes typing {
        0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
        }
        40% {
            opacity: 1;
            transform: scale(1);
        }
    }

    /* File Status */
    .file-status {
        margin: 0 16px 16px;
        background: rgba(47, 47, 47, 0.8);
        border: 1px solid rgba(86, 88, 105, 0.3);
        border-radius: 12px;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        backdrop-filter: blur(10px);
    }

    .file-info {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #b4b4b4;
        font-size: 14px;
    }

    .btn-remove {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.2s;
    }

    .btn-remove:hover {
        background: rgba(239, 68, 68, 0.1);
    }

    /* Input Container */
    .input-container {
        position: sticky;
        bottom: 0;
        background: linear-gradient(to top, #212121 0%, #212121 80%, transparent 100%);
        padding: 16px;
        z-index: 100;
    }

    .input-wrapper {
        background: rgba(47, 47, 47, 0.9);
        border: 1px solid rgba(86, 88, 105, 0.3);
        border-radius: 24px;
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 8px;
        backdrop-filter: blur(20px);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 100%;
    }

    .input-wrapper:focus-within {
        border-color: rgba(16, 163, 127, 0.5);
        box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
    }

    .upload-section {
        display: flex;
        align-items: center;
    }

    .btn-attachment {
        background: none;
        border: none;
        color: #b4b4b4;
        cursor: pointer;
        padding: 8px;
        border-radius: 12px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .btn-attachment:hover {
        background: rgba(86, 88, 105, 0.2);
        color: #ececec;
    }

    .text-input-section {
        flex: 1;
        min-width: 0;
    }

    .message-input {
        width: 100%;
        background: transparent;
        border: none;
        color: #ececec;
        font-size: 15px;
        line-height: 1.5;
        resize: none;
        outline: none;
        font-family: inherit;
        padding: 8px 12px;
        max-height: 200px;
        min-height: 24px;
    }

    .message-input::placeholder {
        color: #8e8ea0;
    }

    .send-section {
        display: flex;
        align-items: center;
    }

    .btn-send {
        background: linear-gradient(135deg, #10a37f 0%, #0d8f6f 100%);
        border: none;
        color: white;
        cursor: pointer;
        padding: 8px;
        border-radius: 12px;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 36px;
        min-height: 36px;
    }

    .btn-send:hover:not(:disabled) {
        background: linear-gradient(135deg, #0d8f6f 0%, #1a7f64 100%);
        transform: scale(1.05);
    }

    .btn-send:disabled {
        background: rgba(86, 88, 105, 0.3);
        cursor: not-allowed;
        transform: none;
    }

    .loading-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    /* Analysis Mode */
    .analysis-mode {
        margin-top: 8px;
        display: flex;
        justify-content: center;
    }

    .analysis-select {
        background: rgba(47, 47, 47, 0.8);
        border: 1px solid rgba(86, 88, 105, 0.3);
        color: #ececec;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 13px;
        outline: none;
        cursor: pointer;
    }

    .analysis-select:focus {
        border-color: rgba(16, 163, 127, 0.5);
    }

    /* Buttons */
    .btn {
        background: rgba(47, 47, 47, 0.8);
        border: 1px solid rgba(86, 88, 105, 0.3);
        color: #ececec;
        padding: 8px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 6px;
        backdrop-filter: blur(10px);
    }

    .btn:hover {
        background: rgba(47, 47, 47, 1);
        border-color: rgba(86, 88, 105, 0.5);
        transform: translateY(-1px);
    }

    .btn-ghost {
        background: transparent;
        border: 1px solid transparent;
    }

    .btn-ghost:hover {
        background: rgba(47, 47, 47, 0.8);
        border-color: rgba(86, 88, 105, 0.3);
    }

    /* History Dropdown */
    .history-dropdown {
        position: relative;
    }

    .history-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: rgba(47, 47, 47, 0.95);
        border: 1px solid rgba(86, 88, 105, 0.3);
        border-radius: 12px;
        backdrop-filter: blur(20px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        z-index: 1000;
        min-width: 320px;
        max-width: 400px;
        max-height: 400px;
        overflow: hidden;
        margin-top: 8px;
        animation: fadeIn 0.2s ease-out;
    }

    .history-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(86, 88, 105, 0.3);
        font-size: 14px;
        font-weight: 600;
        color: #ececec;
    }

    .btn-clear-all {
        background: none;
        border: none;
        color: #ef4444;
        cursor: pointer;
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 6px;
        transition: all 0.2s;
    }

    .btn-clear-all:hover {
        background: rgba(239, 68, 68, 0.1);
    }

    .history-items {
        max-height: 320px;
        overflow-y: auto;
    }

    .history-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(86, 88, 105, 0.1);
        transition: all 0.2s;
    }

    .history-item:hover {
        background: rgba(86, 88, 105, 0.1);
    }

    .history-item:last-child {
        border-bottom: none;
    }

    .history-content {
        flex: 1;
        cursor: pointer;
        min-width: 0;
    }

    .history-title {
        font-size: 14px;
        font-weight: 500;
        color: #ececec;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .history-meta {
        font-size: 12px;
        color: #b4b4b4;
        margin-bottom: 4px;
    }

    .history-preview {
        font-size: 12px;
        color: #8e8ea0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .btn-delete {
        background: none;
        border: none;
        color: #8e8ea0;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition: all 0.2s;
        margin-left: 8px;
        flex-shrink: 0;
    }

    .btn-delete:hover {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
    }

    /* Animations */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .header-content {
            padding: 12px 16px;
        }
        
        .logo {
            font-size: 16px;
        }
        
        .welcome-content h1 {
            font-size: 28px;
        }
        
        .example-prompts {
            grid-template-columns: 1fr;
        }
        
        .message-wrapper {
            padding: 0 12px;
        }
        
        .input-container {
            padding: 12px;
        }
    }

    @media (max-width: 480px) {
        .header-content {
            padding: 8px 12px;
        }
        
        .welcome-content {
            padding: 0 8px;
        }
        
        .welcome-content h1 {
            font-size: 24px;
        }
        
        .message-wrapper {
            padding: 0 8px;
            gap: 12px;
        }
        
        .input-container {
            padding: 8px;
        }
    }

    /* Scrollbar Styling */
    ::-webkit-scrollbar {
        width: 6px;
    }

    ::-webkit-scrollbar-track {
        background: transparent;
    }

    ::-webkit-scrollbar-thumb {
        background: rgba(86, 88, 105, 0.5);
        border-radius: 3px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: rgba(86, 88, 105, 0.7);
    }

    /* Selection */
    ::selection {
        background: rgba(16, 163, 127, 0.3);
    }

    /* Focus Styles */
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible,
    select:focus-visible {
        outline: 2px solid rgba(16, 163, 127, 0.5);
        outline-offset: 2px;
    }

    /* Dark mode optimizations */
    @media (prefers-color-scheme: dark) {
        body {
            color-scheme: dark;
        }
    }
</style>