//! # Access Control Pallet
//!
//! A FRAME pallet for managing role-based access control on resources.
//! Supports `Admin`, `Editor`, and `Viewer` roles, stored per-account per-resource.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use codec::{Decode, Encode};
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use scale_info::TypeInfo;

    /// Role levels for resource access control.
    #[derive(Clone, Copy, PartialEq, Eq, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug)]
    pub enum Role {
        /// Full control: can grant/revoke roles and modify the resource.
        Admin,
        /// Can modify the resource but cannot manage roles.
        Editor,
        /// Read-only access to the resource.
        Viewer,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Configuration trait for the access control pallet.
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching runtime event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    /// Double map storing roles: (account, resource_id) -> Role.
    #[pallet::storage]
    #[pallet::getter(fn roles)]
    pub type Roles<T: Config> =
        StorageDoubleMap<_, Blake2_128Concat, T::AccountId, Blake2_128Concat, u32, Role>;

    /// Events emitted by this pallet.
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A role was granted to an account for a resource.
        RoleGranted {
            account: T::AccountId,
            resource_id: u32,
            role: Role,
        },
        /// A role was revoked from an account for a resource.
        RoleRevoked {
            account: T::AccountId,
            resource_id: u32,
        },
    }

    /// Errors that can occur in this pallet.
    #[pallet::error]
    pub enum Error<T> {
        /// The caller does not have permission for this operation.
        NotAuthorized,
        /// No role was found for the specified account and resource.
        RoleNotFound,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Grant a role to an account for a specific resource.
        ///
        /// Only an existing `Admin` for the resource (or root origin) can grant roles.
        ///
        /// - `account`: The account to receive the role.
        /// - `resource_id`: Numeric identifier of the resource.
        /// - `role`: The role to grant.
        ///
        /// Emits `RoleGranted` on success.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn grant_role(
            origin: OriginFor<T>,
            account: T::AccountId,
            resource_id: u32,
            role: Role,
        ) -> DispatchResult {
            // Allow root or a signed admin for this resource.
            let maybe_who = Self::ensure_admin_or_root(origin, resource_id)?;

            Roles::<T>::insert(&account, resource_id, role);

            Self::deposit_event(Event::RoleGranted {
                account,
                resource_id,
                role,
            });

            let _ = maybe_who;
            Ok(())
        }

        /// Revoke a role from an account for a specific resource.
        ///
        /// An `Admin` for the resource, root, or the account itself can revoke.
        ///
        /// - `account`: The account whose role should be revoked.
        /// - `resource_id`: Numeric identifier of the resource.
        ///
        /// Emits `RoleRevoked` on success.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn revoke_role(
            origin: OriginFor<T>,
            account: T::AccountId,
            resource_id: u32,
        ) -> DispatchResult {
            Self::ensure_admin_root_or_self(origin, resource_id, &account)?;

            // Ensure the role exists before removing.
            Roles::<T>::get(&account, resource_id).ok_or(Error::<T>::RoleNotFound)?;
            Roles::<T>::remove(&account, resource_id);

            Self::deposit_event(Event::RoleRevoked {
                account,
                resource_id,
            });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Verify that the origin is either root or a signed account with `Admin` role
        /// on the specified resource. Returns `Ok(Some(account))` for signed origins
        /// and `Ok(None)` for root.
        fn ensure_admin_or_root(
            origin: OriginFor<T>,
            resource_id: u32,
        ) -> Result<Option<T::AccountId>, DispatchError> {
            if ensure_root(origin.clone()).is_ok() {
                return Ok(None);
            }
            let who = ensure_signed(origin)?;
            let caller_role =
                Roles::<T>::get(&who, resource_id).ok_or(Error::<T>::NotAuthorized)?;
            if caller_role != Role::Admin {
                return Err(Error::<T>::NotAuthorized.into());
            }
            Ok(Some(who))
        }

        /// Verify that the origin is root, an admin for the resource, or the target
        /// account itself.
        fn ensure_admin_root_or_self(
            origin: OriginFor<T>,
            resource_id: u32,
            target: &T::AccountId,
        ) -> Result<(), DispatchError> {
            if ensure_root(origin.clone()).is_ok() {
                return Ok(());
            }
            let who = ensure_signed(origin)?;
            // Allow self-revocation.
            if &who == target {
                return Ok(());
            }
            let caller_role =
                Roles::<T>::get(&who, resource_id).ok_or(Error::<T>::NotAuthorized)?;
            if caller_role != Role::Admin {
                return Err(Error::<T>::NotAuthorized.into());
            }
            Ok(())
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
            AccessControl: pallet,
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
    fn grant_and_check_role() {
        new_test_ext().execute_with(|| {
            let account = 1u64;
            let resource_id = 42u32;

            // Root can grant any role.
            assert_ok!(AccessControl::grant_role(
                RuntimeOrigin::root(),
                account,
                resource_id,
                pallet::Role::Admin,
            ));

            // Verify storage.
            assert_eq!(
                pallet::Roles::<Test>::get(account, resource_id),
                Some(pallet::Role::Admin)
            );

            // Verify event.
            System::assert_last_event(
                pallet::Event::<Test>::RoleGranted {
                    account,
                    resource_id,
                    role: pallet::Role::Admin,
                }
                .into(),
            );

            // Now the admin (account 1) can grant a role to account 2.
            assert_ok!(AccessControl::grant_role(
                RuntimeOrigin::signed(account),
                2u64,
                resource_id,
                pallet::Role::Editor,
            ));
            assert_eq!(
                pallet::Roles::<Test>::get(2u64, resource_id),
                Some(pallet::Role::Editor)
            );

            // A non-admin (account 3) cannot grant roles.
            assert_noop!(
                AccessControl::grant_role(
                    RuntimeOrigin::signed(3u64),
                    4u64,
                    resource_id,
                    pallet::Role::Viewer,
                ),
                pallet::Error::<Test>::NotAuthorized
            );
        });
    }

    #[test]
    fn revoke_role_works() {
        new_test_ext().execute_with(|| {
            let account = 1u64;
            let resource_id = 10u32;

            // Grant a role via root.
            assert_ok!(AccessControl::grant_role(
                RuntimeOrigin::root(),
                account,
                resource_id,
                pallet::Role::Editor,
            ));
            assert!(pallet::Roles::<Test>::get(account, resource_id).is_some());

            // Self-revocation should work.
            assert_ok!(AccessControl::revoke_role(
                RuntimeOrigin::signed(account),
                account,
                resource_id,
            ));
            assert!(pallet::Roles::<Test>::get(account, resource_id).is_none());

            // Revoking a non-existent role should fail.
            assert_noop!(
                AccessControl::revoke_role(RuntimeOrigin::signed(account), account, resource_id,),
                pallet::Error::<Test>::RoleNotFound
            );
        });
    }
}
