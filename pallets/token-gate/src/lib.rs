//! # Token Gate Pallet
//!
//! A FRAME pallet for token-gating access to resources.
//! Stores a `GateRequirement` per resource, specifying which token and
//! minimum balance is required for access.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame_support::pallet]
pub mod pallet {
    use codec::{Decode, Encode};
    use frame_support::pallet_prelude::*;
    use frame_system::pallet_prelude::*;
    use scale_info::TypeInfo;

    /// Defines the token requirement for gating a resource.
    #[derive(Clone, Encode, Decode, TypeInfo, MaxEncodedLen, RuntimeDebug, PartialEq, Eq)]
    pub struct GateRequirement {
        /// Numeric identifier of the required token.
        pub token_id: u32,
        /// Minimum token balance required for access.
        pub min_balance: u128,
    }

    #[pallet::pallet]
    pub struct Pallet<T>(_);

    /// Configuration trait for the token gate pallet.
    #[pallet::config]
    pub trait Config: frame_system::Config {
        /// The overarching runtime event type.
        type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
    }

    /// Map from resource ID to its gate requirement.
    #[pallet::storage]
    #[pallet::getter(fn gates)]
    pub type Gates<T: Config> = StorageMap<_, Blake2_128Concat, u32, GateRequirement>;

    /// Events emitted by this pallet.
    #[pallet::event]
    #[pallet::generate_deposit(pub(super) fn deposit_event)]
    pub enum Event<T: Config> {
        /// A gate requirement was set for a resource.
        GateSet {
            resource_id: u32,
            requirement: GateRequirement,
        },
        /// A gate requirement was removed from a resource.
        GateRemoved { resource_id: u32 },
    }

    /// Errors that can occur in this pallet.
    #[pallet::error]
    pub enum Error<T> {
        /// No gate requirement exists for the specified resource.
        GateNotFound,
    }

    #[pallet::call]
    impl<T: Config> Pallet<T> {
        /// Set a gate requirement for a resource.
        ///
        /// Can be called by any signed origin or root.
        ///
        /// - `resource_id`: Numeric identifier of the resource to gate.
        /// - `requirement`: The token requirement (token ID and minimum balance).
        ///
        /// Emits `GateSet` on success.
        #[pallet::call_index(0)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn set_gate(
            origin: OriginFor<T>,
            resource_id: u32,
            requirement: GateRequirement,
        ) -> DispatchResult {
            Self::ensure_signed_or_root(origin)?;

            Gates::<T>::insert(resource_id, requirement.clone());

            Self::deposit_event(Event::GateSet {
                resource_id,
                requirement,
            });

            Ok(())
        }

        /// Remove a gate requirement from a resource.
        ///
        /// Can be called by any signed origin or root.
        ///
        /// - `resource_id`: Numeric identifier of the resource to ungate.
        ///
        /// Emits `GateRemoved` on success.
        #[pallet::call_index(1)]
        #[pallet::weight(Weight::from_parts(10_000, 0))]
        pub fn remove_gate(origin: OriginFor<T>, resource_id: u32) -> DispatchResult {
            Self::ensure_signed_or_root(origin)?;

            Gates::<T>::get(resource_id).ok_or(Error::<T>::GateNotFound)?;
            Gates::<T>::remove(resource_id);

            Self::deposit_event(Event::GateRemoved { resource_id });

            Ok(())
        }
    }

    impl<T: Config> Pallet<T> {
        /// Ensure the origin is either signed or root.
        fn ensure_signed_or_root(origin: OriginFor<T>) -> Result<(), DispatchError> {
            if ensure_root(origin.clone()).is_ok() {
                return Ok(());
            }
            ensure_signed(origin)?;
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
            TokenGate: pallet,
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
    fn set_gate_works() {
        new_test_ext().execute_with(|| {
            let resource_id = 1u32;
            let requirement = pallet::GateRequirement {
                token_id: 100,
                min_balance: 500,
            };

            // Signed origin can set a gate.
            assert_ok!(TokenGate::set_gate(
                RuntimeOrigin::signed(1),
                resource_id,
                requirement.clone(),
            ));

            // Verify storage.
            assert_eq!(
                pallet::Gates::<Test>::get(resource_id),
                Some(requirement.clone())
            );

            // Verify event.
            System::assert_last_event(
                pallet::Event::<Test>::GateSet {
                    resource_id,
                    requirement,
                }
                .into(),
            );
        });
    }

    #[test]
    fn remove_gate_works() {
        new_test_ext().execute_with(|| {
            let resource_id = 2u32;
            let requirement = pallet::GateRequirement {
                token_id: 200,
                min_balance: 1000,
            };

            // Set a gate first.
            assert_ok!(TokenGate::set_gate(
                RuntimeOrigin::signed(1),
                resource_id,
                requirement,
            ));
            assert!(pallet::Gates::<Test>::get(resource_id).is_some());

            // Remove it.
            assert_ok!(TokenGate::remove_gate(
                RuntimeOrigin::signed(1),
                resource_id,
            ));
            assert!(pallet::Gates::<Test>::get(resource_id).is_none());

            // Removing a non-existent gate should fail.
            assert_noop!(
                TokenGate::remove_gate(RuntimeOrigin::signed(1), resource_id),
                pallet::Error::<Test>::GateNotFound
            );
        });
    }
}
