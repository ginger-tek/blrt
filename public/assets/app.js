const state = Vue.reactive({
  session: {}
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
const shrinkImage = async (file, max = 512, quality = .8) => {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const min = Math.min(img.naturalWidth, img.naturalHeight)
        const offsetX = (img.naturalWidth - min) / 2
        const offsetY = (img.naturalHeight - min) / 2
        canvas.width = max
        canvas.height = max
        canvas.getContext('2d').drawImage(img, offsetX, offsetY, min, min, 0, 0, max, max)
        res(canvas.toDataURL(file.type, quality))
      }
      img.onerror = rej
      img.src = e.target.result
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}
const convertImagesToDataURIs = async (files, opts = {}) => {
  return Promise.all([...files].map(f => shrinkImage(f, opts?.max)))
}
const Toasts = {
  _toasts: Vue.ref([]),
  list() { return this._toasts.value },
  append(message, opts = {}) {
    const id = Date.now()
    this._toasts.value.push({ id, message, ...opts })
    if (!opts.stay && !opts.variant?.match(/danger|warn/))
      setTimeout(() => this.dismiss(id), opts.dismissAfter || 5000)
    return id
  },
  dismiss(id) {
    this._toasts.value = this._toasts.value.filter(t => t.id != id)
  },
  clear() {
    this._toasts.value = []
  }
}

const Toaster = {
  props: {
    state: Object
  },
  template: `<div class="toaster">
    <article v-for="t in state.list()" :class="['toast', t.variant || '']" :key="t.id">
      <div class="message" v-html="t.message"></div>
      <span aria-label="Close" @click="state.dismiss(t.id)">&cross;</span>
    </article>
  </div>`
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
        <button type="submit" class="fill" :disabled="submitting || undefined">Submit Reply</button>
      </form>
    </div>
    <div v-if="!loading && !comments.length" class="text-center">No comments</div>
    <article v-for="com in comments" class="list-item" :key="com.id">
      <small class="meta">
        <img v-if="com.author_pfp" class="pfp sm" :src="com.author_pfp">
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
        Toasts.append(ex.error || ex, { variant: 'danger' })
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
        Toasts.append(ex.error || ex, { variant: 'danger' })
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
  template: `<div v-if="post.id" class="post">
    <small class="meta">
      <img v-if="post.author_pfp" class="pfp sm" :src="post.author_pfp">
      <router-link :to="'/@' + post.author_username">{{ post.author_name }} <small>(@{{ post.author_username }})</small></router-link> &nbsp;&middot;&nbsp; {{ new Date(post.created_at * 1000).toLocaleString() }}
    </small>
    <div v-if="post.media" class="media carousel bottom-spacing-sm" :style="{cursor:allowLink ? 'pointer' : 'unset'}" @click="allowLink ? $router.push('/posts/' + post.id) : null">
      <img class="media-item" v-for="m in post.media.split('|')" :key="m" :src="m">
    </div>
    <div class="bottom-spacing">
      <pre :class="['body', isListItem ? 'sm' : null]">{{ post.body }}</pre>
      <router-link v-if="allowLink" class="stretch" :to="'/posts/' + post.id"></router-link>
    </div>
    <div :class="['flex stretch', isListItem ? 'btns-sm' : null]">
      <button v-if="showComments" type="button" @click="isReplying = !isReplying">{{ !isReplying ? 'Reply (' + post.comment_count + ')' : 'Cancel' }}</button>
      <router-link v-else :to="'/posts/' + post.id" role="button">Comments ({{ post.comment_count }})</router-link>
      <button type="button" @click="submitLike" :disabled="submitting || post.liked">Like ({{ post.like_count }})</button>
      <button type="button">Share</button>
      <button v-if="showDelete && state.session.sub == post.author_id" class="danger" type="button" @click="deleteConfirmRef.open()">Delete</button>
    </div>
    <post-comments v-if="showComments" :show-reply-form="isReplying" @submitted="isReplying = false; post.comment_count++" :post-id="post.id"></post-comments>
    <modal v-if="showDelete" ref="deleteConfirmRef" hide-close>
      <template #title>Delete Post</template>
      <p class="bottom-spacing">Are your sure you want to delete this post?</p>
      <div class="flex stretch">
        <button type="button" @click="deleteConfirmRef.close()">No, Cancel</button>
        <button class="danger" :disabled="deleting || undefined" type="button" @click="deletePost">Yes, Delete</button>
      </div>
    </modal>
  </div>`,
  setup(props) {
    const isReplying = Vue.ref(false)
    const router = VueRouter.useRouter()
    const submitting = Vue.ref(false)
    const deleting = Vue.ref(false)
    const deleteConfirmRef = Vue.ref(null)
    const post = Vue.ref(props.data)

    async function deletePost() {
      try {
        deleting.value = true
        await api(`posts/${post.value.id}`, 'DELETE')
        router.back()
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
        deleting.value = false
      }
    }

    async function submitLike() {
      try {
        submitting.value = true
        await api(`posts/${post.value.id}/like`, 'POST')
        post.value.liked = true
        post.value.like_count++
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
      } finally {
        submitting.value = false
      }
    }

    return { state, post, isReplying, submitting, deleting, deleteConfirmRef, submitLike, deletePost }
  }
}

const SignupView = {
  template: `<h1 class="text-center">Signup</h1>
  <form @submit.prevent="submitSignup" class="container narrow">
    <div :class="{squiggle:submitting}"></div>
    <input class="fill bottom-spacing-sm" v-model="body.username" autocapitalize="off" placeholder="Username" required>
    <input class="fill bottom-spacing-sm" v-model="body.display_name" placeholder="Display Name" required>
    <input class="fill bottom-spacing-sm" v-model="body.password" type="password" placeholder="Password" required>
    <button class="fill" type="submit" :disabled="submitting || undefined">Signup</button>
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
        Toasts.append(ex.error || ex, { variant: 'danger' })
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
    <button class="fill" type="submit" :disabled="submitting || undefined">Login</button>
  </form>`,
  setup() {
    const submitting = Vue.ref(false)
    const body = Vue.reactive({
      username: '',
      password: ''
    })

    async function submitLogin() {
      try {
        Toasts.clear()
        submitting.value = true
        const res = await api('login', 'POST', body)
        if (res.token) {
          state.session = await api('session')
          if (state.session.sub)
            router.replace('/feed')
        }
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
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
        Toasts.append(ex.error || ex, { variant: 'danger' })
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
        <article v-for="user in results.users" class="list-item flex">
          <img v-if="user.pfp" class="pfp sm" :src="user.pfp">
          <div>{{ user.display_name }} <small>(@{{ user.username }})</small></div>
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
          Toasts.clear()
          results.value = {}
          querying.value = true
          results.value = await api('search', 'POST', { query }, abortCtrl.signal)
          router.push({ hash: `#${query}` })
        } catch (ex) {
          if (ex.name === 'AbortError') {
            console.log('Previous request was cancelled');
          } else {
            console.error(ex)
            Toasts.append(ex.error || ex, { variant: 'danger' })
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
    <div :class="{squiggle:submitting||processing}"></div>
    <textarea class="fill bottom-spacing-sm" v-model="post.body" placeholder="What's on your mind?" required></textarea>
    <div class="media grid bottom-spacing" v-if="post.media.length">
      <img class="media-item" v-for="(m,x) in post.media" :key="m" :src="m" @click="post.media.splice(x,1)">
    </div>
    <div class="flex stretch">
      <label role="button" :disabled="processing || undefined">
        <input type="file" @change="processMedia" style="display:none" accept=".jpg,.jpeg,.png,.gif,.webp" multiple>
        Choose Media
      </label>
      <button type="submit" :disabled="submitting || processing || undefined">Submit</button>
    </div>
  </form>`,
  setup() {
    const submitting = Vue.ref(false)
    const processing = Vue.ref(false)
    const post = Vue.reactive({
      body: '',
      media: []
    })

    async function submitCreate() {
      try {
        Toasts.clear()
        if (!post.body) return
        submitting.value = true
        const res = await api('posts', 'POST', post)
        if (res.id)
          router.replace(`/posts/${res.id}`)
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
        submitting.value = false
      }
    }

    async function processMedia(ev) {
      try {
        Toasts.clear()
        processing.value = true
        let files = [...ev.target.files]
        if (files.length > 10) {
          files = files.slice(0, 10)
          Toasts.append('Only the first 10 images will be used', { variant: 'info' })
        }
        post.media = await convertImagesToDataURIs(files)
        ev.target.value = ''
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
      } finally {
        processing.value = false
      }
    }

    return { post, submitting, processing, submitCreate, processMedia }
  }
}

const ProfileView = {
  components: { PostDetails },
  template: `<div :class="{squiggle:loading}"></div>
  <div v-if="user.id">
    <div class="flex bottom-spacing">
      <img class="pfp md" :src="user.pfp"/>
      <div>
        <h2>{{ user.display_name }}</h2>
        <small><a :href="'/@' + user.username">@{{ user.username }}</a> &nbsp;&middot;&nbsp; Joined {{ new Date(user.created_at * 1000).toLocaleDateString() }}</small>
      </div>
    </div>
    <pre>{{ user.bio || "Hi, I'm new here!" }}</pre>
    <template v-if="posts[tab]?.length">
      <hr>
      <h4>Posts</h4>
      <div class="flex stretch bottom-spacing">
        <button type="button" @click="tab ='top'" :disabled="tab == 'top'">Top</button>
        <button type="button" @click="tab = 'recent'" :disabled="tab == 'recent'">Recent</button>
      </div>
      <article v-for="post in posts[tab]" :key="post.id" class="list-item">
        <post-details :data="post" :allow-link="true" :is-list-item="true"></post-details>
      </article>
    </template>
    <div v-else-if="!loading" class="text-center">
      <h5>No posts</h5>
    </div>
  </div>`,
  setup() {
    const loading = Vue.ref(true)
    const route = VueRouter.useRoute()
    const user = Vue.ref({})
    const tab = Vue.ref('top')
    const posts = Vue.ref({})

    async function loadProfile() {
      if (route.params.username)
        user.value = await api(`users/@${route.params.username}`)
      else
        user.value = await api(`profile`)
    }

    async function loadProfilePosts() {
      posts.value = await api(`users/${user.value.id}/posts`)
    }

    Vue.onMounted(async () => {
      try {
        await loadProfile()
        await loadProfilePosts()
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
      } finally {
        loading.value = false
      }
    })

    return { loading, user, posts, tab }
  }
}

const SettingsView = {
  components: { Modal },
  template: `<div :class="{squiggle:loading||submitting}"></div>
  <h3>Profile</h3>
  <form @submit.prevent="saveProfile">
    <div class="flex bottom-spacing-sm">
      <img class="pfp" :src="profile.pfp">
      <label role="button" style="width:fit-content">
        <input type="file" @change="processPfp" style="display:none">
        Choose Profile Photo
      </label>
    </div>
    <input v-model="profile.display_name" placeholder="Display Name" class="fill" required>
    <textarea v-model="profile.bio" placeholder="Bio" class="bottom-spacing-sm fill"></textarea>
    <button type="submit" class="fill" :disabled="submitting">Save Profile</button>
  </form>
  <hr>
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
  <button type="button" @click="submitInterests" :disabled="submitting || undefined" class="fill">Save Interests</button>
  <hr>
  <h3>Account</h3>
  <button type="button" @click="submitLogout" :disabled="submitting || undefined" class="fill">Logout</button>
  <article class="danger top-spacing">
    <h4>Danger Zone!</h4>
    <p>Actions done in this area are irreversable. Take caution!</p>
    <button type="button" @click="deleteConfirmRef.open()" class="fill danger">Delete Account</button>
  </article>
  <modal ref="deleteConfirmRef">
    <template #title>Confirm Account Deletion</template>
    <p class="bottom-spacing">Are you sure you want to permanently delete your account?</p>
    <button type="button" @click="submitDelete" :disabled="submitting || undefined" class="fill danger">Yes, Delete My Account</button>
  </modal>`,
  setup() {
    const loading = Vue.ref(true)
    const submitting = Vue.ref(false)
    const interests = Vue.ref([])
    const removedInterests = Vue.ref([])
    const deleteConfirmRef = Vue.ref(null)
    const profile = Vue.ref({ display_name: state.session.name, bio: null, pfp: null })

    async function loadProfile() {
      profile.value = await api('profile')
    }

    async function loadInterests() {
      interests.value = await api('profile/interests')
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
        Toasts.append('Interests saved!', { variant: 'success' })
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
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
        Toasts.append(ex.error || ex, { variant: 'danger' })
        submitting.value = false
      }
    }

    async function submitDelete() {
      // TODO
      deleteConfirmRef.value.close()
    }

    async function saveProfile() {
      try {
        submitting.value = true
        profile.value = await api('profile', 'PUT', profile.value)
        Toasts.append('Profile saved!', { variant: 'success' })
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
      } finally {
        submitting.value = false
      }
    }

    async function processPfp(ev) {
      try {
        const [pfp] = await convertImagesToDataURIs([ev.target.files[0]], { max: 128 })
        profile.value.pfp = pfp
        ev.target.value = ''
      } catch (ex) {
        console.error(ex)
        Toasts.append(ex.error || ex, { variant: 'danger' })
      }
    }

    Vue.onBeforeMount(async () => {
      loading.value = true
      await Promise.allSettled([loadInterests(), loadProfile()])
      loading.value = false
    })

    return { loading, submitting, state, profile, interests, addInterest, removeInterest, submitInterests, submitLogout, submitDelete, deleteConfirmRef, processPfp, saveProfile }
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
  Toasts.clear()
  if (!state.session.sub && to.meta.auth)
    return '/login'
})

Vue.createApp({
  components: { Toaster },
  template: `<header>
    <nav v-if="state.session.sub" class="flex spread">
      <router-link to="/feed"><i class="bi bi-house-fill"></i> <span>Feed</span></router-link>
      <router-link to="/search"><i class="bi bi-search"></i> <span>Search</span></router-link>
      <router-link to="/create"><i class="bi bi-plus-circle-fill"></i> <span>Create</span></router-link>
      <router-link to="/profile"><i class="bi bi-person-circle"></i> <span>Profile</span></router-link>
      <router-link to="/settings"><i class="bi bi-gear-fill"></i> <span>Settings</span></router-link>
    </nav>
    <nav v-else class="flex center">
      <router-link to="/login">Login</router-link>
      <router-link to="/signup">Signup</router-link>
    </nav>
  </header>
  <main>
    <router-view></router-view>
    <toaster :state="Toasts"></toaster>
  </main>`,
  setup() {
    return { state, Toasts }
  }
})
  .use(router)
  .mount('#app')