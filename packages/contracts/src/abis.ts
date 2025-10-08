//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeGlobals
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeGlobalsAbi = [
  { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function',
    inputs: [],
    name: 'DAO',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GOV',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ITO',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'TLC',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'YDL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ZVE',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ZVL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ZVT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'acceptZVL',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'adjustedSupplies',
    outputs: [
      { name: 'zSTTAdjustedSupply', internalType: 'uint256', type: 'uint256' },
      { name: 'zJTTAdjustedSupply', internalType: 'uint256', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'decreaseDefaults',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'defaults',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'increaseDefaults',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'globals', internalType: 'address[]', type: 'address[]' },
      { name: 'stablecoins', internalType: 'address[]', type: 'address[]' }
    ],
    name: 'initializeGlobals',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isDepositor',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isKeeper',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'isLocker',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '_proposedZVL', internalType: 'address', type: 'address' }],
    name: 'proposeZVL',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'proposedZVL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'stJTT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'stSTT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'stZVE',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'stablecoinWhitelist',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'standardize',
    outputs: [{ name: 'standardizedAmount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'depositor', internalType: 'address', type: 'address' },
      { name: 'status', internalType: 'bool', type: 'bool' }
    ],
    name: 'updateIsDepositor',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'keeper', internalType: 'address', type: 'address' },
      { name: 'status', internalType: 'bool', type: 'bool' }
    ],
    name: 'updateIsKeeper',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'locker', internalType: 'address', type: 'address' },
      { name: 'status', internalType: 'bool', type: 'bool' }
    ],
    name: 'updateIsLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'stablecoin', internalType: 'address', type: 'address' },
      { name: 'allowed', internalType: 'bool', type: 'bool' }
    ],
    name: 'updateStablecoinWhitelist',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '_YDL', internalType: 'address', type: 'address' }],
    name: 'updateYDL',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'vestZVE',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'zJTT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'zSTT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'locker',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'updatedDefaults',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'DefaultsDecreased'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'locker',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'updatedDefaults',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'DefaultsIncreased'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'controller',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'TransferredZVL'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'depositor',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'status', internalType: 'bool', type: 'bool', indexed: false }
    ],
    name: 'UpdatedDepositorStatus'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'status', internalType: 'bool', type: 'bool', indexed: false }
    ],
    name: 'UpdatedKeeperStatus'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'locker',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'status', internalType: 'bool', type: 'bool', indexed: false }
    ],
    name: 'UpdatedLockerStatus'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'asset',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'allowed', internalType: 'bool', type: 'bool', indexed: false }
    ],
    name: 'UpdatedStablecoinWhitelist'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'YDL', internalType: 'address', type: 'address', indexed: true }],
    name: 'UpdatedYDL'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeTrancheToken
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeTrancheTokenAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'name_', internalType: 'string', type: 'string' },
      { name: 'symbol_', internalType: 'string', type: 'string' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'burn',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'allowed', internalType: 'bool', type: 'bool' }
    ],
    name: 'changeMinterRole',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'subtractedValue', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'decreaseAllowance',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'addedValue', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'increaseAllowance',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'isMinter',
    outputs: [{ name: 'minter', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Approval'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'allowed', internalType: 'bool', type: 'bool', indexed: false }
    ],
    name: 'MinterUpdated'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Transfer'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeRewards
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeRewardsAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_stakingToken', internalType: 'address', type: 'address' },
      { name: '_GBL', internalType: 'address', type: 'address' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' }
    ],
    name: 'accountRewardPerTokenPaid',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '_rewardsToken', internalType: 'address', type: 'address' },
      { name: '_rewardsDuration', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'addReward',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'pos', internalType: 'uint32', type: 'uint32' }
    ],
    name: 'checkpoints',
    outputs: [
      {
        name: '',
        internalType: 'struct ZivoeVotes.Checkpoint',
        type: 'tuple',
        components: [
          { name: 'fromBlock', internalType: 'uint32', type: 'uint32' },
          { name: 'votes', internalType: 'uint224', type: 'uint224' }
        ]
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '_rewardsToken', internalType: 'address', type: 'address' },
      { name: 'reward', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'depositReward',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: '_rewardsToken', internalType: 'address', type: 'address' }
    ],
    name: 'earned',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'fullWithdraw',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'blockNumber', internalType: 'uint256', type: 'uint256' }],
    name: 'getPastTotalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'blockNumber', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'getPastVotes',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '_rewardsToken', internalType: 'address', type: 'address' }],
    name: 'getRewardForDuration',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'getRewards',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'getVotes',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '_rewardsToken', internalType: 'address', type: 'address' }],
    name: 'lastTimeRewardApplicable',
    outputs: [{ name: 'timestamp', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'numCheckpoints',
    outputs: [{ name: '', internalType: 'uint32', type: 'uint32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'rewardData',
    outputs: [
      { name: 'rewardsDuration', internalType: 'uint256', type: 'uint256' },
      { name: 'periodFinish', internalType: 'uint256', type: 'uint256' },
      { name: 'rewardRate', internalType: 'uint256', type: 'uint256' },
      { name: 'lastUpdateTime', internalType: 'uint256', type: 'uint256' },
      {
        name: 'rewardPerTokenStored',
        internalType: 'uint256',
        type: 'uint256'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '_rewardsToken', internalType: 'address', type: 'address' }],
    name: 'rewardPerToken',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'rewardTokens',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' }
    ],
    name: 'rewards',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'stake',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'account', internalType: 'address', type: 'address' }
    ],
    name: 'stakeFor',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'stakingToken',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'rewardAsset', internalType: 'address', type: 'address' }
    ],
    name: 'viewAccountRewardPerTokenPaid',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'rewardAsset', internalType: 'address', type: 'address' }
    ],
    name: 'viewRewards',
    outputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'reward',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'RewardAdded'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'reward',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'depositor',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'RewardDeposited'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'rewardsToken',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'reward',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'RewardDistributed'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Staked'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'by', internalType: 'address', type: 'address', indexed: true }
    ],
    name: 'StakedFor'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Withdrawn'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeVault
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeVaultAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_USDC', internalType: 'contract IERC20', type: 'address' },
      { name: '_zSTT', internalType: 'contract IERC20', type: 'address' },
      {
        name: '_stSTT',
        internalType: 'contract IZivoeRewards',
        type: 'address'
      },
      {
        name: '_ZVT',
        internalType: 'contract IZivoeTranches',
        type: 'address'
      }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'DAO',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'USDC',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ZVT',
    outputs: [{ name: '', internalType: 'contract IZivoeTranches', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'asset',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'compound',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'convertToAssets',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'assets', internalType: 'uint256', type: 'uint256' }],
    name: 'convertToShares',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' }
    ],
    name: 'deposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'maxDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'maxMint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'maxRedeem',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'maxWithdraw',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' }
    ],
    name: 'mint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'asset', internalType: 'contract IERC20', type: 'address' }],
    name: 'passThrough',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'assets', internalType: 'uint256', type: 'uint256' }],
    name: 'previewDeposit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'previewMint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'shares', internalType: 'uint256', type: 'uint256' }],
    name: 'previewRedeem',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'assets', internalType: 'uint256', type: 'uint256' }],
    name: 'previewWithdraw',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' }
    ],
    name: 'redeem',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'stSTT',
    outputs: [{ name: '', internalType: 'contract IZivoeRewards', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalAssets',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' }
    ],
    name: 'withdraw',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'zSTT',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Approval'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'assets',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Deposit'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Transfer'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'sender',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'receiver',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'assets',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'shares',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Withdraw'
  },
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC20InsufficientAllowance'
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC20InsufficientBalance'
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover'
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver'
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender'
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender'
  },
  {
    type: 'error',
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC4626ExceededMaxDeposit'
  },
  {
    type: 'error',
    inputs: [
      { name: 'receiver', internalType: 'address', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC4626ExceededMaxMint'
  },
  {
    type: 'error',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'shares', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC4626ExceededMaxRedeem'
  },
  {
    type: 'error',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'assets', internalType: 'uint256', type: 'uint256' },
      { name: 'max', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC4626ExceededMaxWithdraw'
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeRouter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_zSTT', internalType: 'contract IERC20', type: 'address' },
      { name: '_ZVE', internalType: 'contract IERC20', type: 'address' },
      {
        name: '_ZVT',
        internalType: 'contract IZivoeTranches',
        type: 'address'
      },
      { name: '_VLT', internalType: 'contract IZivoeVault', type: 'address' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'VLT',
    outputs: [{ name: '', internalType: 'contract IZivoeVault', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ZVE',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'ZVT',
    outputs: [{ name: '', internalType: 'contract IZivoeTranches', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'stablecoin', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'depositVault',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'stablecoin', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' }
    ],
    name: 'depositWithPermit',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'zSTT',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view'
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeTranches
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeTranchesAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_GBL', internalType: 'address', type: 'address' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPull',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPush',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountSenior', internalType: 'uint256', type: 'uint256' },
      { name: 'assetSenior', internalType: 'address', type: 'address' },
      { name: 'amountJunior', internalType: 'uint256', type: 'uint256' },
      { name: 'assetJunior', internalType: 'address', type: 'address' }
    ],
    name: 'depositBoth',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountSenior', internalType: 'uint256', type: 'uint256' },
      { name: 'assetSenior', internalType: 'address', type: 'address' },
      { name: 'amountJunior', internalType: 'uint256', type: 'uint256' },
      { name: 'assetJunior', internalType: 'address', type: 'address' }
    ],
    name: 'depositBothInverse',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'depositJunior',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'depositSenior',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'isJuniorOpen',
    outputs: [{ name: 'open', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'locked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'lowerRatioIncentiveBIPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxTrancheRatioBIPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'maxZVEPerJTTMint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'minZVEPerJTTMint',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'deposit', internalType: 'uint256', type: 'uint256' }],
    name: 'rewardZVEJuniorDeposit',
    outputs: [{ name: 'reward', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'deposit', internalType: 'uint256', type: 'uint256' }],
    name: 'rewardZVESeniorDeposit',
    outputs: [{ name: 'reward', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'switchPause',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'tranchesUnlocked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnershipAndLock',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'unlock',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_lowerRatioIncentiveBIPS',
        internalType: 'uint256',
        type: 'uint256'
      }
    ],
    name: 'updateLowerRatioIncentiveBIPS',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'ratio', internalType: 'uint256', type: 'uint256' }],
    name: 'updateMaxTrancheRatio',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'max', internalType: 'uint256', type: 'uint256' }],
    name: 'updateMaxZVEPerJTTMint',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'min', internalType: 'uint256', type: 'uint256' }],
    name: 'updateMinZVEPerJTTMint',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      {
        name: '_upperRatioIncentiveBIPS',
        internalType: 'uint256',
        type: 'uint256'
      }
    ],
    name: 'updateUpperRatioIncentiveBIPS',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'upperRatioIncentiveBIPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'asset',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'incentives',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'JuniorDeposit'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'asset',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'incentives',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'SeniorDeposit'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'UpdatedLowerRatioIncentiveBIPS'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'UpdatedMaxTrancheRatioBIPS'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'UpdatedMaxZVEPerJTTMint'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'UpdatedMinZVEPerJTTMint'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'newValue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'UpdatedUpperRatioIncentiveBIPS'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ERC20Permit
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const erc20PermitAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'DOMAIN_SEPARATOR',
    outputs: [{ name: '', internalType: 'bytes32', type: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { name: 'fields', internalType: 'bytes1', type: 'bytes1' },
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'version', internalType: 'string', type: 'string' },
      { name: 'chainId', internalType: 'uint256', type: 'uint256' },
      { name: 'verifyingContract', internalType: 'address', type: 'address' },
      { name: 'salt', internalType: 'bytes32', type: 'bytes32' },
      { name: 'extensions', internalType: 'uint256[]', type: 'uint256[]' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'nonces',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'deadline', internalType: 'uint256', type: 'uint256' },
      { name: 'v', internalType: 'uint8', type: 'uint8' },
      { name: 'r', internalType: 'bytes32', type: 'bytes32' },
      { name: 's', internalType: 'bytes32', type: 'bytes32' }
    ],
    name: 'permit',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Approval'
  },
  { type: 'event', anonymous: false, inputs: [], name: 'EIP712DomainChanged' },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'Transfer'
  },
  { type: 'error', inputs: [], name: 'ECDSAInvalidSignature' },
  {
    type: 'error',
    inputs: [{ name: 'length', internalType: 'uint256', type: 'uint256' }],
    name: 'ECDSAInvalidSignatureLength'
  },
  {
    type: 'error',
    inputs: [{ name: 's', internalType: 'bytes32', type: 'bytes32' }],
    name: 'ECDSAInvalidSignatureS'
  },
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC20InsufficientAllowance'
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'ERC20InsufficientBalance'
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover'
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver'
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender'
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender'
  },
  {
    type: 'error',
    inputs: [{ name: 'deadline', internalType: 'uint256', type: 'uint256' }],
    name: 'ERC2612ExpiredSignature'
  },
  {
    type: 'error',
    inputs: [
      { name: 'signer', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' }
    ],
    name: 'ERC2612InvalidSigner'
  },
  {
    type: 'error',
    inputs: [
      { name: 'account', internalType: 'address', type: 'address' },
      { name: 'currentNonce', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'InvalidAccountNonce'
  },
  { type: 'error', inputs: [], name: 'InvalidShortString' },
  {
    type: 'error',
    inputs: [{ name: 'str', internalType: 'string', type: 'string' }],
    name: 'StringTooLong'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Tether Token
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const tetherTokenAbi = [
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: '_upgradedAddress', type: 'address' }],
    name: 'deprecate',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'deprecated',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: '_evilUser', type: 'address' }],
    name: 'addBlackList',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: '_from', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'upgradedAddress',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    name: 'balances',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'maximumFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: '_totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'unpause',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [{ name: '_maker', type: 'address' }],
    name: 'getBlackListStatus',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' }
    ],
    name: 'allowed',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [{ name: 'who', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'pause',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'getOwner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [
      { name: 'newBasisPoints', type: 'uint256' },
      { name: 'newMaxFee', type: 'uint256' }
    ],
    name: 'setParams',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'issue',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: 'amount', type: 'uint256' }],
    name: 'redeem',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: 'remaining', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'basisPointsRate',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [{ name: '', type: 'address' }],
    name: 'isBlackListed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: '_clearedUser', type: 'address' }],
    name: 'removeBlackList',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: true,
    payable: false,
    type: 'function',
    inputs: [],
    name: 'MAX_UINT',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: 'newOwner', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    constant: false,
    payable: false,
    type: 'function',
    inputs: [{ name: '_blackListedUser', type: 'address' }],
    name: 'destroyBlackFunds',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    payable: false,
    type: 'constructor',
    inputs: [
      { name: '_initialSupply', type: 'uint256' },
      { name: '_name', type: 'string' },
      { name: '_symbol', type: 'string' },
      { name: '_decimals', type: 'uint256' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }],
    name: 'Issue'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }],
    name: 'Redeem'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'newAddress', type: 'address', indexed: false }],
    name: 'Deprecate'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'feeBasisPoints', type: 'uint256', indexed: false },
      { name: 'maxFee', type: 'uint256', indexed: false }
    ],
    name: 'Params'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: '_blackListedUser', type: 'address', indexed: false },
      { name: '_balance', type: 'uint256', indexed: false }
    ],
    name: 'DestroyedBlackFunds'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: '_user', type: 'address', indexed: false }],
    name: 'AddedBlackList'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: '_user', type: 'address', indexed: false }],
    name: 'RemovedBlackList'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ],
    name: 'Approval'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ],
    name: 'Transfer'
  },
  { type: 'event', anonymous: false, inputs: [], name: 'Pause' },
  { type: 'event', anonymous: false, inputs: [], name: 'Unpause' }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OCC_Modular
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const occModularAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'DAO', internalType: 'address', type: 'address' },
      { name: '_stablecoin', internalType: 'address', type: 'address' },
      { name: '_GBL', internalType: 'address', type: 'address' },
      { name: '_underwriter', internalType: 'address', type: 'address' },
      { name: '_OCT_YDL', internalType: 'address', type: 'address' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'OCT_YDL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'acceptOffer',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'amountOwed',
    outputs: [
      { name: 'principal', internalType: 'uint256', type: 'uint256' },
      { name: 'interest', internalType: 'uint256', type: 'uint256' },
      { name: 'lateFee', internalType: 'uint256', type: 'uint256' },
      { name: 'total', internalType: 'uint256', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'applyCombine',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'applyConversionToAmortization',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'applyConversionToBullet',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'applyExtension',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'applyRefinance',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'loanIDs', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'APRLateFee', internalType: 'uint256', type: 'uint256' },
      { name: 'term', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentInterval', internalType: 'uint256', type: 'uint256' },
      { name: 'gracePeriod', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentSchedule', internalType: 'int8', type: 'int8' }
    ],
    name: 'approveCombine',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'approveConversionToAmortization',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'approveConversionToBullet',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      { name: 'intervals', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'approveExtension',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      { name: 'APR', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'approveRefinance',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'callLoan',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPull',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPush',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'cancelOffer',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'combinations',
    outputs: [
      { name: 'APRLateFee', internalType: 'uint256', type: 'uint256' },
      { name: 'term', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentInterval', internalType: 'uint256', type: 'uint256' },
      { name: 'gracePeriod', internalType: 'uint256', type: 'uint256' },
      { name: 'expires', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentSchedule', internalType: 'int8', type: 'int8' },
      { name: 'valid', internalType: 'bool', type: 'bool' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'combineCounter',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'conversionToAmortization',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'conversionToBullet',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'borrower', internalType: 'address', type: 'address' },
      { name: 'borrowAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'APR', internalType: 'uint256', type: 'uint256' },
      { name: 'APRLateFee', internalType: 'uint256', type: 'uint256' },
      { name: 'term', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentInterval', internalType: 'uint256', type: 'uint256' },
      { name: 'gracePeriod', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentSchedule', internalType: 'int8', type: 'int8' }
    ],
    name: 'createOffer',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'extensions',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'loanCounter',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'loanInfo',
    outputs: [
      { name: 'borrower', internalType: 'address', type: 'address' },
      { name: 'paymentSchedule', internalType: 'int8', type: 'int8' },
      { name: 'info', internalType: 'uint256[10]', type: 'uint256[10]' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'loans',
    outputs: [
      { name: 'borrower', internalType: 'address', type: 'address' },
      { name: 'principalOwed', internalType: 'uint256', type: 'uint256' },
      { name: 'APR', internalType: 'uint256', type: 'uint256' },
      { name: 'APRLateFee', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentDueBy', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentsRemaining', internalType: 'uint256', type: 'uint256' },
      { name: 'term', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentInterval', internalType: 'uint256', type: 'uint256' },
      { name: 'offerExpiry', internalType: 'uint256', type: 'uint256' },
      { name: 'gracePeriod', internalType: 'uint256', type: 'uint256' },
      { name: 'paymentSchedule', internalType: 'int8', type: 'int8' },
      {
        name: 'state',
        internalType: 'enum OCC_Modular.LoanState',
        type: 'uint8'
      }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'locked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'makePayment',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'markDefault',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'markRepaid',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'processPayment',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'refinancing',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'resolveDefault',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'stablecoin',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'supplyInterest',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnershipAndLock',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'unapproveCombine',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'unapproveConversionToAmortization',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'unapproveConversionToBullet',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'unapproveExtension',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256' }],
    name: 'unapproveRefinance',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'underwriter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '_OCT_YDL', internalType: 'address', type: 'address' }],
    name: 'updateOCTYDL',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'borrower',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'loanIDs',
        internalType: 'uint256[]',
        type: 'uint256[]',
        indexed: false
      },
      {
        name: 'term',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentInterval',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'gracePeriod',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentSchedule',
        internalType: 'int8',
        type: 'int8',
        indexed: true
      }
    ],
    name: 'CombineApplied'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'loanIDs',
        internalType: 'uint256[]',
        type: 'uint256[]',
        indexed: false
      },
      {
        name: 'APRLateFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'term',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentInterval',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'gracePeriod',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'expires',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentSchedule',
        internalType: 'int8',
        type: 'int8',
        indexed: true
      }
    ],
    name: 'CombineApproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'borrower',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'borrowAmount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'APR', internalType: 'uint256', type: 'uint256', indexed: false },
      {
        name: 'APRLateFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentDueBy',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'term',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentInterval',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'gracePeriod',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentSchedule',
        internalType: 'int8',
        type: 'int8',
        indexed: true
      }
    ],
    name: 'CombineLoanCreated'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: false }],
    name: 'CombineUnapproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ConversionToAmortizationApplied'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ConversionToAmortizationApproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ConversionToAmortizationUnapproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ConversionToBulletApplied'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ConversionToBulletApproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ConversionToBulletUnapproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'principalDefaulted',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'DefaultMarked'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'payee',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'resolved', internalType: 'bool', type: 'bool', indexed: false }
    ],
    name: 'DefaultResolved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'intervals',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'ExtensionApplied'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'intervals',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'ExtensionApproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'ExtensionUnapproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'payee',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'InterestSupplied'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'principal',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'interest',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'lateFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'LoanCalled'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'principal',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'borrower',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'paymentDueBy',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'OfferAccepted'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'OfferCancelled'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'borrower',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'borrowAmount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'APR', internalType: 'uint256', type: 'uint256', indexed: false },
      {
        name: 'APRLateFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'term',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentInterval',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'offerExpiry',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'gracePeriod',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'paymentSchedule',
        internalType: 'int8',
        type: 'int8',
        indexed: true
      }
    ],
    name: 'OfferCreated'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'payee',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'principal',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'interest',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'lateFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'nextPaymentDue',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'PaymentMade'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      {
        name: 'APRNew',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'APRPrior',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'RefinanceApplied'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'id', internalType: 'uint256', type: 'uint256', indexed: true },
      { name: 'APR', internalType: 'uint256', type: 'uint256', indexed: false }
    ],
    name: 'RefinanceApproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'RefinanceUnapproved'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [{ name: 'id', internalType: 'uint256', type: 'uint256', indexed: true }],
    name: 'RepaidMarked'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'newOCT',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'oldOCT',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'UpdatedOCTYDL'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OCC_Variable
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const occVariableAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'DAO', internalType: 'address', type: 'address' },
      { name: '_USDC', internalType: 'address', type: 'address' },
      { name: '_GBL', internalType: 'address', type: 'address' },
      { name: '_underwriter', internalType: 'address', type: 'address' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'USDC',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'user', internalType: 'address', type: 'address' }
    ],
    name: 'adjustLimit',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPull',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPush',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'draw',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'limit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'locked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'base', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnershipAndLock',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'underwriter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'usage',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'user',
        internalType: 'address',
        type: 'address',
        indexed: false
      }
    ],
    name: 'AdjustLimit'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'user',
        internalType: 'address',
        type: 'address',
        indexed: false
      }
    ],
    name: 'Draw'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'base',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'user',
        internalType: 'address',
        type: 'address',
        indexed: false
      }
    ],
    name: 'Repay'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ZivoeITO
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const zivoeItoAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_GBL', internalType: 'address', type: 'address' },
      { name: '_stables', internalType: 'address[]', type: 'address[]' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'airdropClaimed',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'depositor', internalType: 'address', type: 'address' }],
    name: 'claimAirdrop',
    outputs: [
      { name: 'zSTTClaimed', internalType: 'uint256', type: 'uint256' },
      { name: 'zJTTClaimed', internalType: 'uint256', type: 'uint256' },
      { name: 'ZVEVested', internalType: 'uint256', type: 'uint256' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'commence',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amountSenior', internalType: 'uint256', type: 'uint256' },
      { name: 'assetSenior', internalType: 'address', type: 'address' },
      { name: 'amountJunior', internalType: 'uint256', type: 'uint256' },
      { name: 'assetJunior', internalType: 'address', type: 'address' }
    ],
    name: 'depositBoth',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'depositJunior',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'depositSenior',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'end',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'asset', internalType: 'address', type: 'address' }
    ],
    name: 'isJuniorOpen',
    outputs: [{ name: 'open', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'juniorCredits',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'migrateDeposits',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'migrated',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'seniorCredits',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'snapshotJTT',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'snapshotSTT',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    name: 'stables',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'zSTTClaimed',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'zJTTClaimed',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'ZVEVested',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'AirdropClaimed'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'DAI', internalType: 'uint256', type: 'uint256', indexed: false },
      {
        name: 'FRAX',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'USDC',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'USDT',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'DepositsMigrated'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'start',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'end', internalType: 'uint256', type: 'uint256', indexed: false }
    ],
    name: 'ITOCommenced'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'asset',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'credits',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'trancheTokens',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'JuniorDeposit'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'account',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'asset',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'credits',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'trancheTokens',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'SeniorDeposit'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OCC_Cycle
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const occCycleAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'DAO', internalType: 'address', type: 'address' },
      { name: '_USDC', internalType: 'address', type: 'address' },
      { name: '_GBL', internalType: 'address', type: 'address' },
      { name: '_underwriter', internalType: 'address', type: 'address' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'USDC',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'user', internalType: 'address', type: 'address' }
    ],
    name: 'adjustLimit',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'user', internalType: 'address', type: 'address' }
    ],
    name: 'adjustUsage',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPull',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPush',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'users', internalType: 'address[]', type: 'address[]' }
    ],
    name: 'cycle',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'amount', internalType: 'uint256', type: 'uint256' }],
    name: 'draw',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'limit',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'locked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'base', internalType: 'uint256', type: 'uint256' }
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnershipAndLock',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'underwriter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'usage',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'user', internalType: 'address', type: 'address', indexed: true }
    ],
    name: 'AdjustLimit'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'user', internalType: 'address', type: 'address', indexed: true }
    ],
    name: 'AdjustUsage'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'base',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'user', internalType: 'address', type: 'address', indexed: true }
    ],
    name: 'Cycle'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'user', internalType: 'address', type: 'address', indexed: true }
    ],
    name: 'Draw'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'base',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'user', internalType: 'address', type: 'address', indexed: true }
    ],
    name: 'Repay'
  }
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OCR_Cycle
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ocrCycleAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'DAO', internalType: 'address', type: 'address' },
      { name: '_USDC', internalType: 'address', type: 'address' },
      { name: '_GBL', internalType: 'address', type: 'address' },
      { name: '_zVLT', internalType: 'address', type: 'address' },
      { name: '_zSTT', internalType: 'address', type: 'address' },
      { name: '_AAVE_V3_POOL', internalType: 'address', type: 'address' },
      { name: '_aUSDC', internalType: 'address', type: 'address' },
      { name: '_OCC', internalType: 'address', type: 'address' },
      { name: '_underwriter', internalType: 'address', type: 'address' },
      { name: '_redemptionFeeBIPS', internalType: 'uint16', type: 'uint16' }
    ],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'AAVE_V3_POOL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'GBL',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'OCC',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'USDC',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'aUSDC',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'zVLTAmount', internalType: 'uint256', type: 'uint256' }],
    name: 'calculateRedemptionAmount',
    outputs: [
      { name: 'usdcAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'fee', internalType: 'uint256', type: 'uint256' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPull',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullMultiPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPullPartial',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPush',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'pure'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC1155',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMulti',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'canPushMultiERC721',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'users', internalType: 'address[]', type: 'address[]' }
    ],
    name: 'cycle',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'locked',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'uint256[]', type: 'uint256[]' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155BatchReceived',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC1155Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'address', type: 'address' },
      { name: '', internalType: 'uint256', type: 'uint256' },
      { name: '', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'onERC721Received',
    outputs: [{ name: '', internalType: 'bytes4', type: 'bytes4' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pullFromLockerMultiPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pullFromLockerPartial',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLocker',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'ids', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC1155',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'asset', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' }
    ],
    name: 'pushToLockerERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMulti',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [
      { name: 'assets', internalType: 'address[]', type: 'address[]' },
      { name: 'tokenIds', internalType: 'uint256[]', type: 'uint256[]' },
      { name: 'data', internalType: 'bytes[]', type: 'bytes[]' }
    ],
    name: 'pushToLockerMultiERC721',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'zVLTAmount', internalType: 'uint256', type: 'uint256' }],
    name: 'redeemUSDC',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'redemptionFeeBIPS',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnershipAndLock',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'underwriter',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [{ name: '_redemptionFeeBIPS', internalType: 'uint256', type: 'uint256' }],
    name: 'updateRedemptionFeeBIPS',
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    inputs: [],
    name: 'zSTT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    inputs: [],
    name: 'zVLT',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true
      }
    ],
    name: 'OwnershipTransferred'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'aTokenBalance',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'USDCDepositedToAAVE'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'aTokenBalance',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'USDCWithdrawnFromAAVE'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'oldFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'newFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      }
    ],
    name: 'UpdatedRedemptionFeeBIPS'
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'zVLTBurned',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      {
        name: 'USDCRedeemed',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false
      },
      { name: 'fee', internalType: 'uint256', type: 'uint256', indexed: false }
    ],
    name: 'zVLTBurnedForUSDC'
  }
] as const;
