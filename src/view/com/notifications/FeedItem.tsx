import React, {useMemo, useState, useEffect} from 'react'
import {observer} from 'mobx-react-lite'
import {
  Animated,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'
import {AppBskyEmbedImages} from '@atproto/api'
import {AtUri} from '@atproto/api'
import {
  FontAwesomeIcon,
  FontAwesomeIconStyle,
  Props,
} from '@fortawesome/react-native-fontawesome'
import {NotificationsFeedItemModel} from 'state/models/feeds/notifications'
import {PostThreadModel} from 'state/models/content/post-thread'
import {s, colors} from 'lib/styles'
import {ago} from 'lib/strings/time'
import {sanitizeDisplayName} from 'lib/strings/display-names'
import {pluralize} from 'lib/strings/helpers'
import {HeartIconSolid} from 'lib/icons'
import {Text} from '../util/text/Text'
import {UserAvatar} from '../util/UserAvatar'
import {ImageHorzList} from '../util/images/ImageHorzList'
import {Post} from '../post/Post'
import {Link, TextLink} from '../util/Link'
import {useStores} from 'state/index'
import {usePalette} from 'lib/hooks/usePalette'
import {useAnimatedValue} from 'lib/hooks/useAnimatedValue'
import {
  getProfileViewBasicLabelInfo,
  getProfileModeration,
} from 'lib/labeling/helpers'
import {ProfileModeration} from 'lib/labeling/types'
import {formatCount} from '../util/numeric/format'

const MAX_AUTHORS = 5

const EXPANDED_AUTHOR_EL_HEIGHT = 35

interface Author {
  href: string
  handle: string
  displayName?: string
  avatar?: string
  moderation: ProfileModeration
}

export const FeedItem = observer(function ({
  item,
}: {
  item: NotificationsFeedItemModel
}) {
  const store = useStores()
  const pal = usePalette('default')
  const [isAuthorsExpanded, setAuthorsExpanded] = useState<boolean>(false)
  const itemHref = useMemo(() => {
    if (item.isLike || item.isRepost) {
      const urip = new AtUri(item.subjectUri)
      return `/profile/${urip.host}/post/${urip.rkey}`
    } else if (item.isFollow) {
      return `/profile/${item.author.handle}`
    } else if (item.isReply) {
      const urip = new AtUri(item.uri)
      return `/profile/${urip.host}/post/${urip.rkey}`
    }
    return ''
  }, [item])
  const itemTitle = useMemo(() => {
    if (item.isLike || item.isRepost) {
      return 'Post'
    } else if (item.isFollow) {
      return item.author.handle
    } else if (item.isReply) {
      return 'Post'
    }
  }, [item])

  const onToggleAuthorsExpanded = () => {
    setAuthorsExpanded(!isAuthorsExpanded)
  }

  const authors: Author[] = useMemo(() => {
    return [
      {
        href: `/profile/${item.author.handle}`,
        handle: item.author.handle,
        displayName: item.author.displayName,
        avatar: item.author.avatar,
        moderation: getProfileModeration(
          store,
          getProfileViewBasicLabelInfo(item.author),
        ),
      },
      ...(item.additional?.map(({author}) => {
        return {
          href: `/profile/${author.handle}`,
          handle: author.handle,
          displayName: author.displayName,
          avatar: author.avatar,
          moderation: getProfileModeration(
            store,
            getProfileViewBasicLabelInfo(author),
          ),
        }
      }) || []),
    ]
  }, [store, item.additional, item.author])

  if (item.additionalPost?.notFound) {
    // don't render anything if the target post was deleted or unfindable
    return <View />
  }

  const isDirectReply = item.isReply && useMemo(() => {
    const parentUri = item.additionalPost?.thread?.parentUri;
    return parentUri != undefined && new AtUri(parentUri).host == store.me.did;
  }, [item]);

  if (item.isReply || item.isMention || item.isQuote) {
    if (item.additionalPost?.error) {
      // hide errors - it doesnt help the user to show them
      return <View />
    }
    return (
      <Link
        testID={`feedItem-by-${item.author.handle}`}
        href={itemHref}
        title={itemTitle}
        noFeedback
        accessible={false}>
        <Post
          uri={item.uri}
          initView={item.additionalPost}
          style={
            isDirectReply || item.isMention || item.isQuote
              ? {
                backgroundColor: pal.colors.directNotifBg,
                borderColor: pal.colors.directNotifBorder,
              }
              : item.isRead
                ? undefined
                : {
                    backgroundColor: pal.colors.unreadNotifBg,
                    borderColor: pal.colors.unreadNotifBorder,
                  }
          }
        />
      </Link>
    )
  }

  let action = ''
  let icon: Props['icon'] | 'HeartIconSolid'
  let iconStyle: Props['style'] = []
  if (item.isLike) {
    action = 'liked your post'
    icon = 'HeartIconSolid'
    iconStyle = [
      s.red3 as FontAwesomeIconStyle,
      {position: 'relative', top: -4},
    ]
  } else if (item.isRepost) {
    action = 'reposted your post'
    icon = 'retweet'
    iconStyle = [s.green3 as FontAwesomeIconStyle]
  } else if (item.isFollow) {
    action = 'followed you'
    icon = 'user-plus'
    iconStyle = [s.blue3 as FontAwesomeIconStyle]
  } else {
    return null
  }

  return (
    // eslint-disable-next-line
    <Link
      testID={`feedItem-by-${item.author.handle}`}
      style={[
        styles.outer,
        pal.view,
        pal.border,
        item.isRead
          ? undefined
          : {
              backgroundColor: pal.colors.unreadNotifBg,
              borderColor: pal.colors.unreadNotifBorder,
            },
      ]}
      href={itemHref}
      title={itemTitle}
      noFeedback
      accessible={(item.isLike && authors.length === 1) || item.isRepost}>
      <View style={styles.layoutIcon}>
        {/* TODO: Prevent conditional rendering and move toward composable
        notifications for clearer accessibility labeling */}
        {icon === 'HeartIconSolid' ? (
          <HeartIconSolid size={28} style={[styles.icon, ...iconStyle]} />
        ) : (
          <FontAwesomeIcon
            icon={icon}
            size={24}
            style={[styles.icon, ...iconStyle]}
          />
        )}
      </View>
      <View style={styles.layoutContent}>
        <Pressable
          onPress={authors.length > 1 ? onToggleAuthorsExpanded : undefined}
          accessible={false}>
          <CondensedAuthorsList
            visible={!isAuthorsExpanded}
            authors={authors}
            onToggleAuthorsExpanded={onToggleAuthorsExpanded}
          />
          <ExpandedAuthorsList visible={isAuthorsExpanded} authors={authors} />
          <Text style={styles.meta}>
            <TextLink
              key={authors[0].href}
              style={[pal.text, s.bold]}
              href={authors[0].href}
              text={sanitizeDisplayName(
                authors[0].displayName || authors[0].handle,
              )}
            />
            {authors.length > 1 ? (
              <>
                <Text style={[pal.text]}> and </Text>
                <Text style={[pal.text, s.bold]}>
                  {formatCount(authors.length - 1)}{' '}
                  {pluralize(authors.length - 1, 'other')}
                </Text>
              </>
            ) : undefined}
            <Text style={[pal.text]}> {action}</Text>
            <Text style={[pal.textLight]}> {ago(item.indexedAt)}</Text>
          </Text>
        </Pressable>
        {item.isLike || item.isRepost || item.isQuote ? (
          <AdditionalPostText additionalPost={item.additionalPost} />
        ) : null}
      </View>
    </Link>
  )
})

function CondensedAuthorsList({
  visible,
  authors,
  onToggleAuthorsExpanded,
}: {
  visible: boolean
  authors: Author[]
  onToggleAuthorsExpanded: () => void
}) {
  const pal = usePalette('default')
  if (!visible) {
    return (
      <View style={styles.avis}>
        <TouchableOpacity
          style={styles.expandedAuthorsCloseBtn}
          onPress={onToggleAuthorsExpanded}
          accessibilityRole="button"
          accessibilityLabel="Hide user list"
          accessibilityHint="Collapses list of users for a given notification">
          <FontAwesomeIcon
            icon="angle-up"
            size={18}
            style={[styles.expandedAuthorsCloseBtnIcon, pal.text]}
          />
          <Text type="sm-medium" style={pal.text}>
            Hide
          </Text>
        </TouchableOpacity>
      </View>
    )
  }
  if (authors.length === 1) {
    return (
      <View style={styles.avis}>
        <Link
          style={s.mr5}
          href={authors[0].href}
          title={`@${authors[0].handle}`}
          asAnchor>
          <UserAvatar
            size={35}
            avatar={authors[0].avatar}
            moderation={authors[0].moderation.avatar}
          />
        </Link>
      </View>
    )
  }
  return (
    <TouchableOpacity
      accessibilityLabel="Show users"
      accessibilityHint="Opens an expanded list of users in this notification"
      onPress={onToggleAuthorsExpanded}>
      <View style={styles.avis}>
        {authors.slice(0, MAX_AUTHORS).map(author => (
          <View key={author.href} style={s.mr5}>
            <UserAvatar
              size={35}
              avatar={author.avatar}
              moderation={author.moderation.avatar}
            />
          </View>
        ))}
        {authors.length > MAX_AUTHORS ? (
          <Text style={[styles.aviExtraCount, pal.textLight]}>
            +{authors.length - MAX_AUTHORS}
          </Text>
        ) : undefined}
        <FontAwesomeIcon
          icon="angle-down"
          size={18}
          style={[styles.expandedAuthorsCloseBtnIcon, pal.textLight]}
        />
      </View>
    </TouchableOpacity>
  )
}

function ExpandedAuthorsList({
  visible,
  authors,
}: {
  visible: boolean
  authors: Author[]
}) {
  const pal = usePalette('default')
  const heightInterp = useAnimatedValue(visible ? 1 : 0)
  const targetHeight =
    authors.length * (EXPANDED_AUTHOR_EL_HEIGHT + 10) /*10=margin*/
  const heightStyle = {
    height: Animated.multiply(heightInterp, targetHeight),
  }
  useEffect(() => {
    Animated.timing(heightInterp, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
  }, [heightInterp, visible])

  return (
    <Animated.View
      style={[
        heightStyle,
        styles.overflowHidden,
        visible ? s.mb10 : undefined,
      ]}>
      {authors.map(author => (
        <Link
          key={author.href}
          href={author.href}
          title={sanitizeDisplayName(author.displayName || author.handle)}
          style={styles.expandedAuthor}
          asAnchor>
          <View style={styles.expandedAuthorAvi}>
            <UserAvatar
              size={35}
              avatar={author.avatar}
              moderation={author.moderation.avatar}
            />
          </View>
          <View style={s.flex1}>
            <Text
              type="lg-bold"
              numberOfLines={1}
              style={pal.text}
              lineHeight={1.2}>
              {sanitizeDisplayName(author.displayName || author.handle)}
              &nbsp;
              <Text style={[pal.textLight]} lineHeight={1.2}>
                {author.handle}
              </Text>
            </Text>
          </View>
        </Link>
      ))}
    </Animated.View>
  )
}

function AdditionalPostText({
  additionalPost,
}: {
  additionalPost?: PostThreadModel
}) {
  const pal = usePalette('default')
  if (
    !additionalPost ||
    !additionalPost.thread?.postRecord ||
    additionalPost.error
  ) {
    return <View />
  }
  const text = additionalPost.thread?.postRecord.text
  const images = AppBskyEmbedImages.isView(additionalPost.thread.post.embed)
    ? additionalPost.thread.post.embed.images
    : undefined
  return (
    <>
      {text?.length > 0 && <Text style={pal.textLight}>{text}</Text>}
      {images && images?.length > 0 && (
        <ImageHorzList images={images} style={styles.additionalPostImages} />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  overflowHidden: {
    overflow: 'hidden',
  },

  outer: {
    padding: 10,
    paddingRight: 15,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  layoutIcon: {
    width: 70,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  icon: {
    marginRight: 10,
    marginTop: 4,
  },
  layoutContent: {
    flex: 1,
  },
  avis: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aviExtraCount: {
    fontWeight: 'bold',
    paddingLeft: 6,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 6,
    paddingBottom: 2,
  },
  postText: {
    paddingBottom: 5,
    color: colors.black,
  },
  additionalPostImages: {
    marginTop: 5,
    marginLeft: 2,
    opacity: 0.8,
  },

  addedContainer: {
    paddingTop: 4,
    paddingLeft: 36,
  },

  expandedAuthorsCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  expandedAuthorsCloseBtnIcon: {
    marginLeft: 4,
    marginRight: 4,
  },
  expandedAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    height: EXPANDED_AUTHOR_EL_HEIGHT,
  },
  expandedAuthorAvi: {
    marginRight: 5,
  },
})
