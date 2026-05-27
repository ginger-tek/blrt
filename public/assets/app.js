const state = Vue.reactive({
  session: {}
})
const api = async (u, m = 'GET', b = null, s = null) => {
  const r = await fetch(`/api${u}`, {
    method: m,
    headers: { 'content-type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
    signal: s || undefined
  })
  const d = await r.json()
  return r.ok ? d : Promise.reject({ code: r.status, ...d })
}

const PostDetails = {
  props: {
    data: Object,
    hasLink: Boolean,
    size: String
  },
  template: `<div v-if="data.id" :class="['post', size]">
    <small><img v-if="data.author_pfp" :src="data.author_pfp"> <router-link :to="'/@' + data.author_username">{{ data.author_name }} <small>(@{{ data.author_username }})</small></router-link> &nbsp;&middot;&nbsp; {{ new Date(data.created_at * 1000).toLocaleString() }}</small>
    <div>
      <pre>{{ data.body || '...' }}</pre>
      <router-link v-if="hasLink" class="stretch" :to="'/posts/' + data.id"></router-link>
    </div>
  </div>`
}

const SignupView = {
  template: `<h1 class="text-center">Signup</h1>
  <form @submit.prevent="submitSignup">
    <div :class="['text-center',{squiggle:submitting}]">{{ error }}</div>
    <input id="username" v-model="body.username" autocapitalize="off" placeholder="Username" class="fill" required>
    <input id="display_name" v-model="body.display_name" placeholder="Display Name" class="fill" required>
    <input id="password" v-model="body.password" type="password" placeholder="Password" class="fill" required>
    <button type="submit" :disabled="submitting" class="fill">Signup</button>
  </form>`,
  setup() {
    const error = Vue.ref(null)
    const submitting = Vue.ref(false)
    const body = Vue.reactive({
      username: '',
      display_name: '',
      password: ''
    })

    async function submitSignup() {
      try {
        error.value = null
        submitting.value = true
        await api('/auth/signup', 'POST', body)
        router.replace('/login')
      } catch (ex) {
        console.error(ex)
        error.value = ex.error
        submitting.value = false
      }
    }

    return { submitting, error, body, submitSignup }
  }
}

const LoginView = {
  template: `<h1 class="text-center">Login</h1>
  <form @submit.prevent="submitLogin">
    <div :class="['text-center',{squiggle:submitting}]">{{ error }}</div>
    <input id="username" v-model="body.username" autocapitalize="off" placeholder="Username" class="fill" required>
    <input id="password" v-model="body.password" type="password" placeholder="Password" class="fill" required>
    <button type="submit" :disabled="submitting" class="fill">Login</button>
  </form>`,
  setup() {
    const error = Vue.ref(null)
    const submitting = Vue.ref(false)
    const body = Vue.reactive({
      username: '',
      password: ''
    })

    async function submitLogin() {
      try {
        error.value = null
        submitting.value = true
        const res = await api('/auth/login', 'POST', body)
        if (res.token) {
          state.session = await api('/auth/session')
          if (state.session.sub)
            router.replace('/feed')
        }
      } catch (ex) {
        console.error(ex)
        error.value = ex.error
        submitting.value = false
      }
    }

    return { submitting, error, body, submitLogin }
  }
}

const FeedView = {
  components: { PostDetails },
  template: `<div :class="['text-center',{squiggle:loading}]">{{ error }}</div>
    <div v-if="!loading && posts.length == 0" class="text-center">
      <h2>No posts</h2>
      <p>Looks like there's nothing here yet. Otherwise, you can try adjusting your interests</p>
      <router-link role="button" class="inline" to="/settings">Settings</router-link>
    </div>
    <section v-for="post in posts" class="list-item">
      <post-details :data="post" :has-link="true" size="sm"></post-details>
    </section>`,
  setup() {
    const error = Vue.ref(null)
    const loading = Vue.ref(true)
    const posts = Vue.ref([])

    async function loadPosts() {
      try {
        const { items } = await api('/feed')
        posts.value = items
      } catch (ex) {
        console.error(ex)
        error.value = ex.error
      } finally {
        loading.value = false
      }
    }

    Vue.onMounted(loadPosts)

    return { loading, error, posts }
  }
}

const PostView = {
  components: { PostDetails },
  template: `<div :class="{squiggle:loading}"></div>
    <post-details v-if="post.id" :data="post"></post-details>`,
  setup() {
    const route = VueRouter.useRoute()
    const post = Vue.ref({})
    const loading = Vue.ref(true)

    async function loadPost() {
      try {
        loading.value = true
        post.value = await api(`/posts/${route.params.id}`)
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
  <div :class="[{squiggle:querying},'top-spacing']">{{ error }}</div>
  <div v-if="results.total !== undefined">
    <h3 class="text-center">{{ results.total || 'No' }} Results</h3>
    <div v-if="results.total > 0">
      <h4>Posts</h4>
      <section v-for="post in results.posts" class="list-item">
        <post-details :data="post" :has-link="true" size="sm"></post-details>
      </section>
      <hr>
      <h4>Users</h4>
      <section v-for="user in results.users" class="list-item">
        <img v-if="user.pfp" :src="user.pfp"> <router-link :to="'/@' + user.username">{{ user.display_name }} <small>(@{{ user.username }})</small></router-link>
      </section>
    </div>
  </div>`,
  setup() {
    const error = Vue.ref(null)
    const searchEl = Vue.ref(null)
    const querying = Vue.ref(false)
    const results = Vue.ref({})
    const route = VueRouter.useRoute()

    let debounce, abortCtrl
    function submitSearch(e) {
      const query = e.target.value.trim()
      if (abortCtrl)
        abortCtrl.abort()
      if (!query.length || error.value) {
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
          results.value = await api('/search', 'POST', { query }, abortCtrl.signal)
          router.push({ hash: `#${query}` })
        } catch (ex) {
          if (ex.name === 'AbortError') {
            console.log('Previous request was cancelled');
          } else {
            console.error(ex)
            error.value = ex.error
          }
        } finally {
          querying.value = false
        }
      }, 500)
    }

    Vue.onMounted(() => {
      const query = route.hash.replace('#','')
      if (query) {
        searchEl.value.value = query
        searchEl.value.dispatchEvent(new Event('input'))
      }
    })

    return { error, querying, results, searchEl, submitSearch }
  }
}

const CreateView = {
  template: `<form @submit.prevent="submitCreate">
      <div :class="{squiggle:submitting}">{{ error }}</div>
      <textarea v-model="post.body" placeholder="What's on your mind?" class="fill" required></textarea>
      <button type="submit" :disabled="submitting" class="fill">Submit</button>
    </form>`,
  setup() {
    const error = Vue.ref(null)
    const submitting = Vue.ref(false)
    const post = Vue.reactive({
      body: ''
    })

    async function submitCreate() {
      try {
        if (!post.body) return
        error.value = null
        submitting.value = true
        const res = await api('/posts', 'POST', post)
        if (res.id)
          router.replace(`/posts/${res.id}`)
      } catch (ex) {
        console.error(ex)
        error.value = ex.message
        submitting.value = false
      }
    }

    return { error, submitting, post, submitCreate }
  }
}

const ProfileView = {
  components: { PostDetails },
  template: `<div :class="{squiggle:loading}">{{ error }}</div>
  <div v-if="user.id">
    <img class="pfp" v-if="user.pfp" :src="user.pfp"/>
    <h2>{{ user.display_name }}</h2>
    <div class="bottom-spacing">
      <small><a :href="'/@' + user.username">@{{ user.username }}</a> &nbsp;&middot;&nbsp; Joined {{ new Date(user.created_at * 1000).toLocaleDateString() }}</small>
    </div>
    <pre>{{ user.bio || "I'm new here!" }}</pre>
    <hr>
    <h4>Posts</h4>
    <div class="flex stretch">
      <button type="button" @click="posts = user.posts.top">Top</button>
      <button type="button" @click="posts = user.posts.recent">Recent</button>
    </div>
    <section v-for="post in posts" class="list-item">
      <post-details :data="post" :has-link="true" size="sm"></post-details>
    </section>
  </div>`,
  setup() {
    const error = Vue.ref(null)
    const loading = Vue.ref(true)
    const route = VueRouter.useRoute()
    const user = Vue.ref({})
    const posts = Vue.ref([])

    Vue.onMounted(async () => {
      try {
        if (route.params.username)
          user.value = await api(`/users/@${route.params.username}`)
        else
          user.value = await api(`/profile`)
        posts.value = user.value.posts.top
      } catch (ex) {
        console.error(ex)
        error.value = ex.error
      } finally {
        loading.value = false
      }
    })

    return { error, loading, user, posts }
  }
}

const SettingsView = {
  template: `<div :class="{squiggle:loading||submitting}">{{ error }}</div>
  <h3>Interests</h3>
  <form @submit.prevent="addInterest" class="flex">
    <input name="interest" class="fill" placeholder="Enter a keyword or phrase" required>
    <button type="submit">Add</button>
  </form>
  <div v-if="!loading && interests.length == 0" class="text-center">
    <p>No interests set</p>
  </div>
  <div class="tags">
    <div class="tag" v-for="(v,x) in interests" :key="v">
      {{ v }}
      <span @click="removeInterest(v)" aria-label="Remove">&cross;</span>
    </div>
  </div>
  <button type="button" @click="submitInterests" :disabled="!interests.length || submitting" class="fill">Save Interests</button>
  <hr>
  <h3>Account</h3>
  <button type="button" @click="submitLogout" :disabled="submitting" class="fill">Logout</button>
  <section class="danger top-spacing">
    <h4>Danger Zone!</h4>
    <p>Actions done in this area are irreversable. Take caution!</p>
    <button type="button" @click="submitDelete" :disabled="submitting" class="fill danger">Delete Account</button>
  </section>`,
  setup() {
    const error = Vue.ref(null)
    const loading = Vue.ref(true)
    const submitting = Vue.ref(false)
    const interests = Vue.ref([])
    const removedInterests = Vue.ref([])

    async function loadInterests() {
      loading.value = true
      interests.value = await api('/profile/interests')
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
        error.value = null
        if (interests.value == 0) return
        submitting.value = true
        await api('/profile/interests', 'PUT', {
          interests: interests.value,
          removed: removedInterests.value
        })
      } catch (ex) {
        console.error(ex)
        error.value = ex.error
      } finally {
        submitting.value = false
      }
    }

    async function submitLogout() {
      try {
        submitting.value = true
        await api('/auth/logout', 'POST')
        state.session = {}
        router.replace('/login')
      } catch (ex) {
        console.error(ex)
        error.value = ex.error
        submitting.value = false
      }
    }

    async function submitDelete() {

    }

    Vue.onBeforeMount(loadInterests)

    return { error, loading, submitting, state, interests, addInterest, removeInterest, submitInterests, submitLogout, submitDelete }
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
  state.session = await api('/auth/session').catch(() => ({}))

router.beforeEach((to) => {
  if (!state.session.sub && to.meta.auth)
    return '/login'
})

Vue.createApp({
  template: `<header>
    <nav v-if="state.session.sub" class="flex spread">
      <router-link to="/feed">Feed</router-link>
      <router-link to="/search">Search</router-link>
      <router-link to="/create">Create</router-link>
      <router-link to="/profile">Profile</router-link>
      <router-link to="/settings">Settings</router-link>
    </nav>
    <nav v-else>
      <router-link to="/login">Login</router-link>
      <router-link to="/signup">Signup</router-link>
    </nav>
  </header>
  <main>
    <router-view></router-view>
  </main>`,
  setup() {
    return { state }
  }
})
  .use(router)
  .mount('#app')