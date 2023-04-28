<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NButton, NInput, NSpin, useMessage } from 'naive-ui'
import axios from 'axios'
import { aredeem } from '@/api'
import { useUserStore } from '@/store'
import type { UserInfo } from '@/store/modules/user/helper'
const loading = ref(false)
const loadingg = ref(false)
const couponCode = ref('')
const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)
const ms = useMessage()

function updateUserInfo(options: Partial<UserInfo>) {
  userStore.updateUserInfo(options)
}

async function redeemCoupon() {
  const acouponCoded = couponCode.value.trim()
  try {
    loading.value = true

    // 调用 redeemCoupon 函数来兑换优惠码

    const data = { couponCode: acouponCoded }

    const pp = await aredeem(data)

    // 显示成功消息
    ms.success('使用成功')
    // 清空输入框
    couponCode.value = ''
    loading.value = false
    const updateDescription = () => {
      // 将 usageCount 的值转换为字符串，并赋值给 userInfo.description

      userInfo.value.kcishu = String(pp.newUsageLimit)

      // 调用 updateUserInfo 方法，将新的用户信息传递进去
      // const usagelimi = (parseInt(userInfo.value.description, 10) - parseInt(userInfo.value.kcishu, 10)).toString()

      updateUserInfo({ description: userInfo.value.description })
      updateUserInfo({ kcishu: userInfo.value.kcishu })
    }
    updateDescription()
  }
  catch (error: any) {
    ms.error(error.message || '使用失败')
    loading.value = false
  }
}
// interface ConfigState {
//   timeoutMs?: number
//   reverseProxy?: string
//   apiModel?: string
//   socksProxy?: string
//   httpsProxy?: string
//   usage?: string
// // }

// const authStore = useAuthStore()
const username = ref(localStorage.getItem('email')?.trim() ?? '123')
// const config = ref<ConfigState>()

// computed<boolean>(() => !!authStore.isChatGPTAPI)

// async function fetchConfig() {
//   try {
//     loading.value = true
//     const { data } = await fetchChatConfig<ConfigState>()
//     config.value = data
//   }
//   finally {
//     loading.value = false
//   }
// }

// onMounted(() => {
//   fetchConfig()
// })
function handleBuyCard() {
  const url = `https://www.aipiaxi.cn/wp-content/plugins/erphpdown/payment/f2fpay.php?ice_post=688&redirect_url=https%3A%2F%2Fwww.aipiaxi.cn%2Findex.php%2F2023%2F04%2F15%2F688%2F%3Ftimestamp%3D1681575458&num=1&data=${username.value}`
  const width = 600
  const height = 400
  const left = (window.innerWidth / 2) - (width / 2)
  const top = (window.innerHeight / 2) - (height / 2)
  window.open(url, '', `toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,resizable=no,copyhistory=no,width=${width},height=${height},top=${top},left=${left}`)
}
const stock = ref('')
function mounted() {
  axios.get('https://www.aipiaxi.cn/wp-content/plugins/erphpdown/buy.php?postid=688')
    .then((response) => {
      const html = response.data
      const regex = /<span>（库存：(\d+)）<\/span>/
      const match = html.match(regex)

      if (match)
        stock.value = match[1]
    })
    .catch((error) => {
      ms.error(error.message)
    })
}
mounted()
// 在页面加载时调用getStock函数获取库存数量并更新页面上的H1元素
</script>

<template>
  <div class="p-4 space-y-5 min-h-[200px]">
    <div class="space-y-6">
      <NSpin :show="loadingg">
        <div class="p-4 space-y-4">
          <h2 class="text-xl font-bold">
            <span class="flex-shrink-0 w-[120px]">卡密充值</span>
          </h2>
          <div class="flex-1">
            <NInput v-model:value="couponCode" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }" />
          </div>

          <NButton
            size="small"
            :disabled=" loadingg"
            :loading="loadingg"
            style="display: inline-block"
            @click="redeemCoupon"
          >
            <span>
              充值
            </span>
          </NButton>
        </div>
        <table class="table-auto">
          <div class="p-4">
            <NButton @click="handleBuyCard">
              1000次卡密1元
            </NButton>
            <div style="display: inline-block">
              库存：{{ stock }}
            </div>
          </div>
        </table>
        <div class="flex items-center space-x-4">
          <H1>
            支付完，去邮箱拿卡密充值，如有充值问题，<a href="https://jq.qq.com/?_wv=1027&k=B5eDvj0v" style="color: red;">联系客服</a>
            <p>本站使用的是35元/月<a href="https://url.cn/dErLLTYm" style="color: red;">海外轻量服务器</a></p>
            <p>代部署一样的网站联系QQ1055480437</p>
          </H1>
        </div>
      </NSpin>
    </div>
  </div>
</template>
