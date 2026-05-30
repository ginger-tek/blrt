const state = Vue.reactive({
  session: {},
  toasts: []
})
const api = async (u, m = 'GET', b = null, s = null) => {
  const r = await fetch(`/api/${u}`, {
    method: m,
    headers: { 'content-type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
    signal: s || undefined
  })
  const d = await r.json()
  return r.ok ? d : Promise.reject({ code: r.status, ...d })
}

const Toaster = {
  template: `<div class="toaster">
    <article v-for="t in state.toasts" :class="['toast', t.variant || '']" :key="t.id">
      <div class="message" v-html="t.message"></div>
      <span aria-label="Close" @click="dismiss(t.id)">&cross;</span>
    </article>
  </div>`,
  setup() {
    function dismiss(id) {
      state.toasts = state.toasts.filter(t => t.id != id)
    }

    return { state, dismiss }
  },
  append: (message, opts = {}) => {
    const id = Date.now()
    state.toasts.push({ id, message, ...opts })
    if (!opts.stay && !opts.variant.match(/danger|warning/))
      setTimeout(() => state.toasts = state.toasts.filter(t => t.id != id), opts.dismissAfter || 3000)
  }
}

const Modal = {
  props: {
    hideClose: Boolean
  },
  template: `<dialog class="modal" ref="modalRef">
    <article>
      <header>
        <b><slot name="title">Modal</slot></b>
        <button v-if="!hideClose" aria-label="Close" @click="modalRef.close()">&cross;</button>
      </header>
      <slot></slot>
    </article>
  </dialog>`,
  emits: ['open', 'close'],
  setup(_, { emit, expose }) {
    const modalRef = Vue.ref(null)

    const open = () => {
      emit('open')
      modalRef.value.showModal()
    }

    const close = () => {
      emit('close')
      modalRef.value.close()
    }

    expose({ open, close })

    return { modalRef }
  }
}

const PostComments = {
  props: {
    postId: String,
    showReplyForm: Boolean
  },
  emits: ['submitted', 'submitting'],
  template: `<div class="top-spacing">
    <div :class="{squiggle:loading||submitting}"></div>
    <div v-show="showReplyForm" class="bottom-spacing">
      <form @submit.prevent="submitReply" ref="replyFormRef">
        <textarea class="fill bottom-spacing-sm" name="body" placeholder="Enter to reply..." required></textarea>
        <button type="submit" class="fill" :disabled="submitting">Submit Reply</button>
      </form>
    </div>
    <div v-if="!loading && !comments.length" class="text-center">No comments</div>
    <article v-for="com in comments" class="list-item" :key="com.id">
      <small class="meta">
        <img v-if="com.author_pfp" class="pfp" :src="com.author_pfp">
        <router-link :to="'/@' + com.author_username">{{ com.author_name }} <small>(@{{ com.author_username }})</small></router-link> &nbsp;&middot;&nbsp; {{ new Date(com.created_at * 1000).toLocaleString() }}
      </small>
      <pre class="body">{{ com.body }}</pre>
    </article>
  </div>`,
  setup(props, { emit }) {
    const loading = Vue.ref(true)
    const comments = Vue.ref([])
    const submitting = Vue.ref(false)
    const replyFormRef = Vue.ref(null)

    async function fetchComments() {
      try {
        loading.value = true
        comments.value = await api(`posts/${props.postId}/comments`)
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
      } finally {
        loading.value = false
      }
    }

    async function submitReply(ev) {
      try {
        emit('submitting')
        submitting.value = true
        const reply = await api(`posts/${props.postId}/comments`, 'POST', { body: ev.target.body.value.trim() })
        comments.value.unshift(reply)
        replyFormRef.value.reset()
        emit('submitted', reply)
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
      } finally {
        submitting.value = false
      }
    }

    Vue.watch(() => props.showReplyForm, (n) => !n && replyFormRef.value.reset())
    Vue.onBeforeMount(fetchComments)

    return { comments, loading, submitting, replyFormRef, submitReply }
  }
}

const PostDetails = {
  components: { PostComments, Modal },
  props: {
    data: Object,
    allowLink: Boolean,
    showComments: Boolean,
    showDelete: Boolean,
    isListItem: Boolean
  },
  template: `<div v-if="data.id" class="post">
    <small class="meta">
      <img v-if="data.author_pfp" class="pfp" :src="data.author_pfp">
      <router-link :to="'/@' + data.author_username">{{ data.author_name }} <small>(@{{ data.author_username }})</small></router-link> &nbsp;&middot;&nbsp; {{ new Date(data.created_at * 1000).toLocaleString() }}
    </small>
    <div class="bottom-spacing">
      <pre :class="['body', isListItem ? 'sm' : null]">{{ data.body }}</pre>
      <router-link v-if="allowLink" class="stretch" :to="'/posts/' + data.id"></router-link>
    </div>
    <div :class="['flex stretch', isListItem ? 'btns-sm' : null]">
      <button v-if="showComments" type="button" @click="isReplying = !isReplying">{{ !isReplying ? 'Reply' : 'Cancel' }}</button>
      <button type="button">Like</button>
      <button type="button">Share</button>
      <button v-if="showDelete && state.session.sub == data.author_id" class="danger" type="button" @click="deleteConfirmRef.open()">Delete</button>
    </div>
    <post-comments v-if="showComments" :show-reply-form="isReplying" @submitted="isReplying = false" :post-id="data.id"></post-comments>
    <modal v-if="showDelete" ref="deleteConfirmRef" hide-close>
      <template #title>Delete Post</template>
      <p class="bottom-spacing">Are your sure you want to delete this post?</p>
      <div class="flex stretch">
        <button type="button" @click="deleteConfirmRef.close()">No, Cancel</button>
        <button class="danger" :disabled="deleting" type="button" @click="deletePost">Yes, Delete</button>
      </div>
    </modal>
  </div>`,
  setup(props) {
    const isReplying = Vue.ref(false)
    const router = VueRouter.useRouter()
    const deleting = Vue.ref(false)
    const deleteConfirmRef = Vue.ref(null)

    async function deletePost() {
      try {
        deleting.value = true
        await api(`posts/${props.data.id}`, 'DELETE')
        router.back()
      } catch (ex) {
        console.error(ex)
        deleting.value = false
        alert(ex.error)
      }
    }

    return { state, isReplying, deleting, deleteConfirmRef, deletePost }
  }
}

const SignupView = {
  template: `<h1 class="text-center">Signup</h1>
  <form @submit.prevent="submitSignup" class="container narrow">
    <div :class="{squiggle:submitting}"></div>
    <input class="fill bottom-spacing-sm" v-model="body.username" autocapitalize="off" placeholder="Username" required>
    <input class="fill bottom-spacing-sm" v-model="body.display_name" placeholder="Display Name" required>
    <input class="fill bottom-spacing-sm" v-model="body.password" type="password" placeholder="Password" required>
    <button class="fill" type="submit" :disabled="submitting">Signup</button>
  </form>`,
  setup() {
    const submitting = Vue.ref(false)
    const body = Vue.reactive({
      username: '',
      display_name: '',
      password: ''
    })

    async function submitSignup() {
      try {
        submitting.value = true
        await api('signup', 'POST', body)
        router.replace('/login')
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
        submitting.value = false
      }
    }

    return { submitting, body, submitSignup }
  }
}

const LoginView = {
  template: `<h1 class="text-center">Login</h1>
  <form @submit.prevent="submitLogin" class="container narrow">
    <div :class="{squiggle:submitting}"></div>
    <input class="fill bottom-spacing-sm" v-model="body.username" autocapitalize="off" placeholder="Username" required>
    <input class="fill bottom-spacing-sm" v-model="body.password" type="password" placeholder="Password" required>
    <button class="fill" type="submit" :disabled="submitting">Login</button>
  </form>`,
  setup() {
    const submitting = Vue.ref(false)
    const body = Vue.reactive({
      username: '',
      password: ''
    })

    async function submitLogin() {
      try {
        submitting.value = true
        const res = await api('login', 'POST', body)
        if (res.token) {
          state.session = await api('session')
          if (state.session.sub)
            router.replace('/feed')
        }
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
        submitting.value = false
      }
    }

    return { submitting, body, submitLogin }
  }
}

const FeedView = {
  components: { PostDetails },
  template: `<div :class="{squiggle:loading}"></div>
    <div v-if="!loading && posts.length == 0" class="text-center">
      <h2>No posts</h2>
      <p>Looks like there's nothing here yet.<br>Post something new, or you can try updating your interest settings</p>
      <router-link role="button" class="inline" to="/create">Create</router-link>&nbsp;
      <router-link role="button" class="inline" to="/settings">Settings</router-link>
    </div>
    <article v-for="post in posts" class="list-item">
      <post-details :data="post" :allow-link="true" :is-list-item="true"></post-details>
    </article>`,
  setup() {
    const loading = Vue.ref(true)
    const posts = Vue.ref([])

    async function loadPosts() {
      try {
        const { items } = await api('feed')
        posts.value = items
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
      } finally {
        loading.value = false
      }
    }

    Vue.onMounted(loadPosts)

    return { loading, posts }
  }
}

const PostView = {
  components: { PostDetails },
  template: `<div :class="{squiggle:loading}"></div>
  <post-details v-if="post.id" :data="post" :show-comments="true" :show-delete="true"></post-details>`,
  setup() {
    const route = VueRouter.useRoute()
    const post = Vue.ref({})
    const loading = Vue.ref(true)

    async function loadPost() {
      try {
        loading.value = true
        post.value = await api(`posts/${route.params.id}`)
      } catch (ex) {
        console.error(ex)
      } finally {
        loading.value = false
      }
    }

    Vue.onMounted(loadPost)

    return { loading, post }
  }
}

const SearchView = {
  components: { PostDetails },
  template: `<input ref="searchEl" type="search" class="fill" name="query" @input="submitSearch" autocomplete="off" placeholder="Type to search" required>
  <div :class="[{squiggle:querying},'top-spacing']"></div>
  <div v-if="results.total !== undefined">
    <h4 class="text-center">{{ results.total || 'No' }} Results</h4>
    <div v-if="results.total > 0">
      <div v-if="results.posts.length > 0">
        <h5>Posts</h5>
        <article v-for="post in results.posts" class="list-item">
          <post-details :data="post" :allow-link="true" :is-list-item="true"></post-details>
        </article>
      </div>
      <hr v-if="results.users.length > 0 && results.posts.length > 0">
      <div v-if="results.users.length > 0">
        <h5>Users</h5>
        <article v-for="user in results.users" class="list-item">
          <img v-if="user.pfp" :src="user.pfp"> {{ user.display_name }} <small>(@{{ user.username }})</small>
          <router-link :to="'/@' + user.username" class="stretch"></router-link>
        </article>
      </div>
    </div>
  </div>`,
  setup() {
    const searchEl = Vue.ref(null)
    const querying = Vue.ref(false)
    const results = Vue.ref({})
    const route = VueRouter.useRoute()

    let debounce, abortCtrl
    function submitSearch(e) {
      const query = e.target.value.trim()
      if (abortCtrl)
        abortCtrl.abort()
      if (!query.length) {
        results.value = {}
        router.push({ hash: '' })
        return
      }
      clearTimeout(debounce)
      abortCtrl = new AbortController()
      debounce = setTimeout(async () => {
        try {
          results.value = {}
          querying.value = true
          results.value = await api('search', 'POST', { query }, abortCtrl.signal)
          router.push({ hash: `#${query}` })
        } catch (ex) {
          if (ex.name === 'AbortError') {
            console.log('Previous request was cancelled');
          } else {
            console.error(ex)
            Toaster.append(ex.error, { variant: 'danger' })
          }
        } finally {
          querying.value = false
        }
      }, 500)
    }

    Vue.onMounted(() => {
      const query = route.hash.replace('#', '')
      if (query) {
        searchEl.value.value = query
        searchEl.value.dispatchEvent(new Event('input'))
      }
    })

    return { querying, results, searchEl, submitSearch }
  }
}

const CreateView = {
  template: `<form @submit.prevent="submitCreate">
    <div :class="{squiggle:submitting}"></div>
    <textarea class="fill bottom-spacing-sm" v-model="post.body" placeholder="What's on your mind?" required></textarea>
    <button class="fill" type="submit" :disabled="submitting">Submit</button>
  </form>`,
  setup() {
    const submitting = Vue.ref(false)
    const post = Vue.reactive({
      body: ''
    })

    async function submitCreate() {
      try {
        if (!post.body) return
        submitting.value = true
        const res = await api('posts', 'POST', post)
        if (res.id)
          router.replace(`/posts/${res.id}`)
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
        submitting.value = false
      }
    }

    return { submitting, post, submitCreate }
  }
}

const ProfileView = {
  components: { PostDetails },
  template: `<div :class="{squiggle:loading}"></div>
  <div v-if="user.id">
    <img class="pfp" v-if="user.pfp" :src="user.pfp"/>
    <h2>{{ user.display_name }}</h2>
    <div class="bottom-spacing">
      <small><a :href="'/@' + user.username">@{{ user.username }}</a> &nbsp;&middot;&nbsp; Joined {{ new Date(user.created_at * 1000).toLocaleDateString() }}</small>
    </div>
    <pre>{{ user.bio || "Hi, I'm new here!" }}</pre>
    <hr>
    <template v-if="posts.length">
    <h4>Posts</h4>
    <div class="flex stretch bottom-spacing">
      <button type="button" @click="posts = user.posts.top">Top</button>
      <button type="button" @click="posts = user.posts.recent">Recent</button>
    </div>
    <article v-for="post in posts" class="list-item">
      <post-details :data="post" :allow-link="true" :is-list-item="true"></post-details>
    </article>
    </template>
    <div v-else class="text-center">
      <h5>No posts</h5>
    </div>
  </div>`,
  setup() {
    const loading = Vue.ref(true)
    const route = VueRouter.useRoute()
    const user = Vue.ref({})
    const posts = Vue.ref([])

    Vue.onMounted(async () => {
      try {
        if (route.params.username)
          user.value = await api(`users/@${route.params.username}`)
        else
          user.value = await api(`profile`)
        posts.value = user.value.posts.top
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
      } finally {
        loading.value = false
      }
    })

    return { loading, user, posts }
  }
}

const SettingsView = {
  components: { Modal },
  template: `<div :class="{squiggle:loading||submitting}"></div>
  <h3>Interests</h3>
  <form @submit.prevent="addInterest" class="flex">
    <input name="interest" class="fill" placeholder="Enter keyword(s) or username" required>
    <button type="submit">Add</button>
  </form>
  <div v-if="!loading && interests.length == 0" class="text-center">
    <p>No interests set</p>
  </div>
  <div class="tags">
    <div class="tag" v-for="(v,x) in interests" :key="v">
      {{ v }} <i v-if="v == '*'">(anything)</i>
      <button @click="removeInterest(v)" aria-label="Remove" title="Remove">&cross;</button>
    </div>
  </div>
  <button type="button" @click="submitInterests" :disabled="submitting" class="fill">Save Interests</button>
  <hr>
  <h3>Account</h3>
  <button type="button" @click="submitLogout" :disabled="submitting" class="fill">Logout</button>
  <article class="danger top-spacing">
    <h4>Danger Zone!</h4>
    <p>Actions done in this area are irreversable. Take caution!</p>
    <button type="button" @click="deleteConfirmRef.open()" class="fill danger">Delete Account</button>
  </article>
  <modal ref="deleteConfirmRef">
    <template #title>Confirm Account Deletion</template>
    <p class="bottom-spacing">Are you sure you want to permanently delete your account?</p>
    <button type="button" @click="submitDelete" :disabled="submitting" class="fill danger">Yes, Delete My Account</button>
  </modal>`,
  setup() {
    const loading = Vue.ref(true)
    const submitting = Vue.ref(false)
    const interests = Vue.ref([])
    const removedInterests = Vue.ref([])
    const deleteConfirmRef = Vue.ref(null)

    async function loadInterests() {
      loading.value = true
      interests.value = await api('profile/interests')
      loading.value = false
    }

    function addInterest(e) {
      interests.value = [...new Set([...interests.value, e.target.interest.value])]
      e.target.reset()
    }

    function removeInterest(v) {
      interests.value = interests.value.filter(i => i !== v)
      removedInterests.value.push(v)
    }

    async function submitInterests() {
      try {
        submitting.value = true
        await api('profile/interests', 'PUT', {
          interests: interests.value,
          removed: removedInterests.value
        })
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
      } finally {
        submitting.value = false
      }
    }

    async function submitLogout() {
      try {
        submitting.value = true
        await api('logout', 'POST')
        state.session = {}
        router.replace('/login')
      } catch (ex) {
        console.error(ex)
        Toaster.append(ex.error, { variant: 'danger' })
        submitting.value = false
      }
    }

    async function submitDelete() {
      // TODO
      deleteConfirmRef.value.close()
    }

    Vue.onBeforeMount(loadInterests)

    return { loading, submitting, state, interests, addInterest, removeInterest, submitInterests, submitLogout, submitDelete, deleteConfirmRef }
  }
}

const NotFoundView = {
  template: `<div class="text-center">
    <h2>Not Found</h2>
    <p>This has either moved or was removed</p>
    <button class="inline" type="button" @click="$router.back()">Back</button>
  </div>`
}

const router = VueRouter.createRouter({
  history: VueRouter.createWebHistory(),
  routes: [
    { path: '/', redirect: '/feed' },
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignupView },
    { path: '/feed', meta: { auth: 1 }, component: FeedView },
    { path: '/posts/:id', meta: { auth: 1 }, component: PostView },
    { path: '/search', meta: { auth: 1 }, component: SearchView },
    { path: '/create', meta: { auth: 1 }, component: CreateView },
    { path: '/profile', meta: { auth: 1 }, component: ProfileView },
    { path: '/@:username', meta: { auth: 1 }, component: ProfileView },
    { path: '/settings', meta: { auth: 1 }, component: SettingsView },
    { path: '/:pathMatch(.*)', component: NotFoundView },
  ]
})

const hasCookie = await cookieStore.get('exp')
if (hasCookie?.value)
  state.session = await api('session').catch(() => ({}))

router.beforeEach((to) => {
  if (!state.session.sub && to.meta.auth)
    return '/login'
})

Vue.createApp({
  components: { Toaster },
  template: `<header>
    <nav v-if="state.session.sub" class="flex spread">
      <router-link to="/feed">Feed</router-link>
      <router-link to="/search">Search</router-link>
      <router-link to="/create">Create</router-link>
      <router-link to="/profile">Profile</router-link>
      <router-link to="/settings">Settings</router-link>
    </nav>
    <nav v-else class="flex center">
      <router-link to="/login">Login</router-link>
      <router-link to="/signup">Signup</router-link>
    </nav>
  </header>
  <main>
    <router-view></router-view>
    <toaster></toaster>
  </main>`,
  setup() {
    return { state }
  }
})
  .use(router)
  .mount('#app')