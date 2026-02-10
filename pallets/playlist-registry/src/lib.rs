//! # Playlist Registry Pallet
//!
//! A FRAME pallet for registering and managing IPTV playlists on-chain.
//! Each account can register up to `MaxPlaylistsPerAccount` playlists,
//! each identified by a name and a hash of the source URL.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use codec::{Decode, Encode};
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use scale_info::TypeInfo;

    /// Metadata for a registered playlist.
    #[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
    #[scale_info(skip_type_params(BoundedString))]
    pub struct PlaylistMetadata<BoundedString> {
        /// Human-readable name of the playlist.
        pub name: BoundedString,
        /// SHA-256 hash of the source URL.
        pub source_url_hash: [u8; 32],
        /// Number of channels in the playlist.
        pub channel_count: u32,
        /// Block number at which the playlist was created.
        pub created_at: u64,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Configuration trait for the playlist registry pallet.
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching runtime event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;

        /// Maximum number of playlists a single account can register.
        #[pallet::constant]
        type MaxPlaylistsPerAccount: Get<u32>;

        /// Maximum length (in bytes) for a playlist name.
        #[pallet::constant]
        type MaxPlaylistNameLength: Get<u32>;
    }

    /// Map from account to their registered playlists.
    #[pallet::storage]
    #[pallet::getter(fn playlist_map)]
    pub type PlaylistMap<T: Config> = StorageMap<
        _,
        Blake2_128Concat,
        T::AccountId,
        BoundedVec<
            PlaylistMetadata<BoundedVec<u8, T::MaxPlaylistNameLength>>,
            T::MaxPlaylistsPerAccount,
        >,
        ValueQuery,
    >;

    /// Global counter of registered playlists.
    #[pallet::storage]
    #[pallet::getter(fn playlist_count)]
    pub type PlaylistCount<T: Config> = StorageValue<_, u32, ValueQuery>;

    /// Events emitted by this pallet.
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A new playlist was registered.
        PlaylistRegistered {
            who: T::AccountId,
            name: BoundedVec<u8, T::MaxPlaylistNameLength>,
        },
        /// A playlist was removed.
        PlaylistRemoved { who: T::AccountId, index: u32 },
    }

    /// Errors that can occur in this pallet.
    #[pallet::error]
    pub enum Error<T> {
        /// The account has reached the maximum number of playlists.
        TooManyPlaylists,
        /// The specified playlist index does not exist.
        PlaylistNotFound,
        /// The playlist name exceeds the maximum allowed length.
        NameTooLong,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Register a new playlist for the calling account.
        ///
        /// - `name`: Human-readable playlist name (must not exceed `MaxPlaylistNameLength`).
        /// - `source_url_hash`: A 32-byte hash of the playlist source URL.
        ///
        /// Emits `PlaylistRegistered` on success.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn register_playlist(
            origin: OriginFor<T>,
            name: sp_std::vec::Vec<u8>,
            source_url_hash: [u8; 32],
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            let bounded_name: BoundedVec<u8, T::MaxPlaylistNameLength> =
                name.try_into().map_err(|_| Error::<T>::NameTooLong)?;

            let metadata = PlaylistMetadata {
                name: bounded_name.clone(),
                source_url_hash,
                channel_count: 0,
                created_at: 0,
            };

            PlaylistMap::<T>::try_mutate(&who, |playlists| {
                playlists
                    .try_push(metadata)
                    .map_err(|_| Error::<T>::TooManyPlaylists)
            })?;

            PlaylistCount::<T>::mutate(|count| {
                *count = count.saturating_add(1);
            });

            Self::deposit_event(Event::PlaylistRegistered {
                who,
                name: bounded_name,
            });

            Ok(())
        }

        /// Remove a playlist by its index in the caller's playlist list.
        ///
        /// - `index`: Zero-based index of the playlist to remove.
        ///
        /// Emits `PlaylistRemoved` on success.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn remove_playlist(origin: OriginFor<T>, index: u32) -> DispatchResult {
            let who = ensure_signed(origin)?;

            PlaylistMap::<T>::try_mutate(&who, |playlists| -> DispatchResult {
                let idx = index as usize;
                if idx >= playlists.len() {
                    return Err(Error::<T>::PlaylistNotFound.into());
                }
                playlists.remove(idx);
                Ok(())
            })?;

            PlaylistCount::<T>::mutate(|count| {
                *count = count.saturating_sub(1);
            });

            Self::deposit_event(Event::PlaylistRemoved { who, index });

            Ok(())
        }

        /// Update the channel count for a playlist at the given index.
        ///
        /// - `index`: Zero-based index of the playlist to update.
        /// - `count`: The new channel count value.
        #[pallet::call_index(2)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn update_channel_count(
            origin: OriginFor<T>,
            index: u32,
            count: u32,
        ) -> DispatchResult {
            let who = ensure_signed(origin)?;

            PlaylistMap::<T>::try_mutate(&who, |playlists| {
                let idx = index as usize;
                let playlist = playlists.get_mut(idx).ok_or(Error::<T>::PlaylistNotFound)?;
                playlist.channel_count = count;
                Ok(())
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use frame_support::{
        assert_noop, assert_ok, derive_impl,
        traits::{ConstU32, ConstU64},
    };
    use sp_core::H256;
    use sp_io::TestExternalities;
    use sp_runtime::{
        traits::{BlakeTwo256, IdentityLookup},
        BuildStorage,
    };

    type Block = frame_system::mocking::MockBlock<Test>;

    frame_support::construct_runtime!(
        pub enum Test {
            System: frame_system,
            PlaylistRegistry: pallet,
        }
    );

    #[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
    impl frame_system::Config for Test {
        type BaseCallFilter = frame_support::traits::Everything;
        type BlockWeights = ();
        type BlockLength = ();
        type DbWeight = ();
        type RuntimeOrigin = RuntimeOrigin;
        type RuntimeCall = RuntimeCall;
        type Nonce = u64;
        type Hash = H256;
        type Hashing = BlakeTwo256;
        type AccountId = u64;
        type Lookup = IdentityLookup<Self::AccountId>;
        type Block = Block;
        type RuntimeEvent = RuntimeEvent;
        type BlockHashCount = ConstU64<250>;
        type Version = ();
        type PalletInfo = PalletInfo;
        type AccountData = ();
        type OnNewAccount = ();
        type OnKilledAccount = ();
        type SystemWeightInfo = ();
        type SS58Prefix = ();
        type OnSetCode = ();
        type MaxConsumers = ConstU32<16>;
    }

    impl pallet::Config for Test {
        type RuntimeEvent = RuntimeEvent;
        type MaxPlaylistsPerAccount = ConstU32<5>;
        type MaxPlaylistNameLength = ConstU32<64>;
    }

    /// Build a test externalities instance with default genesis state.
    fn new_test_ext() -> TestExternalities {
        let t = frame_system::GenesisConfig::<Test>::default()
            .build_storage()
            .expect("genesis build should succeed in tests");
        let mut ext = TestExternalities::new(t);
        ext.execute_with(|| System::set_block_number(1));
        ext
    }

    #[test]
    fn register_playlist_works() {
        new_test_ext().execute_with(|| {
            let name = b"My Playlist".to_vec();
            let hash = [1u8; 32];

            assert_ok!(PlaylistRegistry::register_playlist(
                RuntimeOrigin::signed(1),
                name.clone(),
                hash,
            ));

            // Verify storage
            let playlists = pallet::PlaylistMap::<Test>::get(1);
            assert_eq!(playlists.len(), 1);
            assert_eq!(playlists[0].source_url_hash, hash);
            assert_eq!(playlists[0].channel_count, 0);
            assert_eq!(pallet::PlaylistCount::<Test>::get(), 1);

            // Verify event
            let expected_name: frame_support::BoundedVec<u8, ConstU32<64>> =
                name.try_into().expect("name fits in test");
            System::assert_last_event(
                pallet::Event::<Test>::PlaylistRegistered {
                    who: 1,
                    name: expected_name,
                }
                .into(),
            );
        });
    }

    #[test]
    fn remove_playlist_works() {
        new_test_ext().execute_with(|| {
            let name = b"Remove Me".to_vec();
            let hash = [2u8; 32];

            assert_ok!(PlaylistRegistry::register_playlist(
                RuntimeOrigin::signed(1),
                name,
                hash,
            ));
            assert_eq!(pallet::PlaylistMap::<Test>::get(1).len(), 1);
            assert_eq!(pallet::PlaylistCount::<Test>::get(), 1);

            assert_ok!(PlaylistRegistry::remove_playlist(
                RuntimeOrigin::signed(1),
                0,
            ));

            assert_eq!(pallet::PlaylistMap::<Test>::get(1).len(), 0);
            assert_eq!(pallet::PlaylistCount::<Test>::get(), 0);

            // Removing a non-existent playlist should fail
            assert_noop!(
                PlaylistRegistry::remove_playlist(RuntimeOrigin::signed(1), 0),
                pallet::Error::<Test>::PlaylistNotFound
            );
        });
    }
}
